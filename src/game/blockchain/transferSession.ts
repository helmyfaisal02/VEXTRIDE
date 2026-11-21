import { toHex, type Hash } from 'viem'
import { createStore } from 'zustand/vanilla'
import { ARC_MAINNET, parseChainId } from './arcConfig'
import { createTransferRpc, transferData, type TransferQuote } from './transferRpc'
import { isTransactionHash, TransferCheckError, validateTransfer } from './transferValidation'
import { inspectWallet, providerErrorCode } from './walletProvider'
import { createTransferHistory, forAccount, isUnresolved, recordIntent, TRANSFER_KEY } from './transferHistory'
import type { TransferRecord } from './transferHistory'
import { walletSession } from './walletSession'

type Status = 'idle' | 'validating' | 'review' | 'wallet' | 'rejected' | 'submitted' |
  'pending' | 'confirmed' | 'reverted' | 'rpc-error' | 'unknown'

interface TransferState {
  status: Status
  message: string
  quote: TransferQuote | null
  hash: Hash | null
  checking: boolean
}

const initial: TransferState = { status: 'idle', message: '', quote: null, hash: null, checking: false }
type Wallet = Pick<typeof walletSession, 'getTransferContext' | 'refresh'>

type Exclusive = <T>(action: () => T | Promise<T>) => Promise<T>

function memoryHistory() {
  let raw: string | null = null
  return createTransferHistory(() => ({
    getItem: () => raw,
    setItem: (_key, value) => { raw = value },
  }))
}

export function createTransferSession(
  wallet: Wallet,
  rpc: Pick<ReturnType<typeof createTransferRpc>, 'quote' | 'verify'>,
  walletTimeout = 90_000,
  history = memoryHistory(),
  exclusive: Exclusive = async action => await action(),
) {
  const store = createStore<TransferState>(() => initial)
  let revision = 0
  let operationId: string | undefined
  let handoff = false
  let checkingId: string | undefined
  let reviewedContext: ReturnType<Wallet['getTransferContext']> = null

  function locked() {
    const sender = wallet.getTransferContext()?.address ?? null
    return handoff || forAccount(history.store.getState().records, sender).some(isUnresolved)
  }

  function clearDraft() {
    if (handoff) return
    revision++
    reviewedContext = null
    operationId = undefined
    store.setState({ ...initial, checking: !!checkingId })
  }

  function invalidateWallet() {
    if (!handoff) clearDraft()
  }

  async function checkWallet(context: NonNullable<ReturnType<Wallet['getTransferContext']>>) {
    const [accounts, chain] = await inspectWallet(context.provider)
    const first: unknown = Array.isArray(accounts) ? accounts[0] : undefined
    if (!context.isCurrent() || typeof first !== 'string' ||
        first.toLowerCase() !== context.address.toLowerCase() || parseChainId(chain) !== ARC_MAINNET.chain.id) {
      throw new TransferCheckError('The wallet account or network changed. Review again on Arc Mainnet.')
    }
  }

  function failPreflight(error: unknown) {
    reviewedContext = null
    store.setState({
      status: 'rpc-error', quote: null,
      message: error instanceof TransferCheckError ? error.message :
        'Arc could not validate, simulate or estimate the transfer. No wallet request was sent.',
    })
  }

  async function review(recipient: string, amount: string) {
    history.sync()
    if (locked() || store.getState().status === 'validating') return
    clearDraft()
    const current = revision
    const context = wallet.getTransferContext()
    try {
      if (!context) throw new TransferCheckError('Connect a wallet on Arc Mainnet first.')
      const intent = validateTransfer(context.address, recipient, amount)
      store.setState({ status: 'validating' })
      await checkWallet(context)
      if (revision !== current) return
      const quote = await rpc.quote(intent)
      if (revision !== current) return
      if (!context.isCurrent()) throw new TransferCheckError('The wallet changed. Review the transfer again.')
      reviewedContext = context
      store.setState({ status: 'review', quote })
    } catch (error) {
      if (revision === current) failPreflight(error)
    }
  }

  async function refreshStatus(id = operationId, candidate?: string): Promise<boolean> {
    history.sync()
    const context = wallet.getTransferContext()
    const record = history.store.getState().records.find(item => item.id === id)
    const hash = record?.hash ?? candidate?.trim()
    if (!context || !record || context.address !== record.sender ||
        !isTransactionHash(hash) || checkingId || (!record.hash && record.status !== 'unknown' && record.status !== 'awaiting') ||
        (!record.hash && handoff)) return false

    checkingId = record.id
    store.setState({ checking: true })
    try {
      const observed = await rpc.verify(hash, recordIntent(record))
      const outcome = 'block' in observed && observed.block <= BigInt(record.head)
        ? { status: 'unknown' as const } : observed
      if (!context.isCurrent()) return false
      const terminal = 'block' in outcome
      if (!isUnresolved(record)) {
        const matching = terminal && outcome.status === record.status && outcome.block.toString() === record.block &&
          (outcome.status !== 'confirmed' || outcome.logIndex === record.logIndex)
        if (matching) history.markVerified(record)
        return matching
      }
      if (!record.hash && !terminal) return false

      const status = outcome.status === 'pending' && history.now() - record.createdAt > 30 * 60 * 1000
        ? 'unknown' : outcome.status
      const saved = await exclusive(() => {
        if (!context.isCurrent()) return null
        return history.update(record.id, {
          status, hash: hash.toLowerCase() as Hash,
          checkedAt: Math.max(history.now(), record.createdAt),
          block: terminal ? outcome.block.toString() : null,
          logIndex: outcome.status === 'confirmed' ? outcome.logIndex : null,
        })
      })
      if (!saved) return false
      if (operationId === record.id) store.setState({ status, hash: saved.hash })
      if (terminal && context.isCurrent() && saved.hash === hash.toLowerCase() &&
          saved.status === outcome.status && saved.block === outcome.block.toString() &&
          (outcome.status !== 'confirmed' || saved.logIndex === outcome.logIndex)) {
        history.markVerified(saved)
        void wallet.refresh()
      }
      return terminal || !!record.hash
    } catch {
      if (context.isCurrent() && record.hash && isUnresolved(record)) {
        try {
          await exclusive(() => {
            if (context.isCurrent()) history.update(record.id, {
              status: 'unavailable', checkedAt: Math.max(history.now(), record.createdAt),
            })
          })
        } catch { /* A read remains retryable when the browser journal is unavailable. */ }
        if (operationId === record.id) store.setState({ status: 'rpc-error' })
      }
      return false
    } finally {
      checkingId = undefined
      store.setState({ checking: false })
    }
  }

  async function confirm(approvedQuote: TransferQuote) {
    const { status, quote } = store.getState()
    const context = reviewedContext
    if (status !== 'review' || !quote || quote !== approvedQuote || !context) return
    const current = ++revision
    const { intent } = quote
    reviewedContext = null
    store.setState({ status: 'validating', quote: null, message: '' })
    let latest: TransferQuote
    try {
      if (!context.isCurrent()) throw new TransferCheckError('The wallet changed. Review the transfer again.')
      latest = await rpc.quote(intent)
      if (revision !== current) return
      await checkWallet(context)
      if (revision !== current) return
      if (latest.fee > quote.fee) {
        reviewedContext = context
        store.setState({ status: 'review', quote: latest, message: 'The fee estimate increased. Review the new total before confirming.' })
        return
      }
    } catch (error) {
      if (revision === current) failPreflight(error)
      return
    }

    let timer: ReturnType<typeof setTimeout> | undefined
    let id: string | undefined
    try {
      const request = await exclusive(async () => {
        if (current !== revision || handoff) return null
        await checkWallet(context)
        if (current !== revision || handoff) return null

        let record: TransferRecord
        try {
          record = history.begin(intent, latest.head)
        } catch {
          history.sync()
          throw new TransferCheckError('Cannot reserve this transfer. Resolve any pending activity and check local storage.')
        }

        id = record.id
        operationId = id
        handoff = true
        store.setState({ status: 'wallet' })
        timer = setTimeout(() => {
          store.setState({ status: 'unknown' })
          void exclusive(() => history.update(record.id, { status: 'unknown' })).catch(() => {})
        }, walletTimeout)

        // The lock is held for reservation and dispatch, then released while the extension prompts.
        const send = async () => context.provider.request({
          method: 'eth_sendTransaction',
          params: [{
            chainId: ARC_MAINNET.chainIdHex, from: intent.sender,
            to: ARC_MAINNET.usdcAddress, data: transferData(intent), value: '0x0',
            type: '0x2', gas: toHex(latest.gas), maxFeePerGas: toHex(latest.maxFeePerGas),
            maxPriorityFeePerGas: '0x0',
          }],
        })
        return { id: record.id, result: send().then(value => ({ value }), (error: unknown) => ({ error })) }
      })
      if (!request) return
      const result = await request.result
      clearTimeout(timer)
      if ('error' in result) throw result.error
      if (!isTransactionHash(result.value)) throw new Error('Invalid transaction hash')
      const hash = result.value.toLowerCase() as Hash
      const saved = await exclusive(() => history.update(request.id, { status: 'submitted', hash }))
      if (!saved || saved.hash !== hash) throw new Error('Duplicate or unavailable transaction hash')
      handoff = false
      store.setState({ status: 'submitted', hash, message: '' })
      void refreshStatus(request.id)
    } catch (error) {
      clearTimeout(timer)
      if (!id) {
        if (current === revision) failPreflight(error)
        return
      }
      const status = providerErrorCode(error) === 4001 ? 'rejected' : 'unknown'
      const recordId = id
      try {
        await exclusive(() => history.update(recordId, { status }))
      } catch { /* The reserved operation stays unresolved on disk. */ }
      handoff = false
      store.setState({ status })
    } finally {
      if (id) handoff = false
    }
  }

  return { store, history, clearDraft, invalidateWallet, review, confirm, refreshStatus, locked }
}

export const transferRpc = createTransferRpc()
export const transferSession = createTransferSession(walletSession, transferRpc, 90_000,
  createTransferHistory(() => window.localStorage),
  action => navigator.locks
    ? navigator.locks.request(TRANSFER_KEY, action)
    : Promise.reject(new TransferCheckError('Transfer history locking is unavailable in this browser.')),
)
