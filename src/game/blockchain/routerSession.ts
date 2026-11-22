import { formatUnits, toHex, type Address, type Hash } from 'viem'
import { createStore } from 'zustand/vanilla'
import { ARC_MAINNET, parseChainId } from './arcConfig'
import { ROUTER, routerData, routerTarget } from './routerContract'
import { createRouterJournal, newPaymentReference, ROUTER_JOURNAL, routerIntent, routerUnresolved, sameRouterRecord, type RouterRecord } from './routerJournal'
import { createRouterRpc, ROUTER_AMOUNT_LIMIT, sameAddress, type RouterQuote } from './routerRpc'
import { isTransactionHash, TransferCheckError, validateTransfer } from './transferValidation'
import { inspectWallet, providerErrorCode } from './walletProvider'
import { walletSession } from './walletSession'

type Wallet = Pick<typeof walletSession, 'getTransferContext' | 'refresh'>
type Context = NonNullable<ReturnType<Wallet['getTransferContext']>>
type Exclusive = <T>(action: () => T | Promise<T>) => Promise<T>
interface RouterState {
  record: RouterRecord | null
  quote: RouterQuote | null
  busy: boolean
  awaitingWallet: boolean
  verified: boolean
  notice: string
  volatileHash: Hash | null
}

const initial: RouterState = {
  record: null, quote: null, busy: false, awaitingWallet: false, verified: false, notice: '', volatileHash: null,
}

export function createRouterSession(wallet: Wallet, rpc: ReturnType<typeof createRouterRpc>,
  journal: ReturnType<typeof createRouterJournal>, exclusive: Exclusive, walletTimeout = 90_000,
  reference = newPaymentReference) {
  const store = createStore<RouterState>(() => initial)
  let revision = 0
  let handoff = false
  let reviewed: { wallet: Context; record: RouterRecord | null } | null = null
  const observed = new Map<Address, RouterRecord>()

  function sync() {
    const context = wallet.getTransferContext()
    try {
      const record = context ? journal.read(context.address) : null
      const previous = store.getState().record
      if (!sameRouterRecord(previous, record)) {
        store.setState({ record, verified: false })
      }
      const volatileHash = context ? observed.get(context.address)?.hash ?? null : null
      if (store.getState().volatileHash !== volatileHash) store.setState({ volatileHash })
    } catch {
      store.setState({ record: null, verified: false, notice: 'Router journal is unavailable or invalid. Payments are blocked.' })
    }
  }

  function clearDraft() {
    revision++
    reviewed = null
    store.setState({ quote: null, busy: false, notice: '', volatileHash: null })
  }

  function invalidateWallet() {
    clearDraft()
    store.setState({ record: null, verified: false })
    sync()
  }

  const current = (context: Context, generation: number) => generation === revision && context.isCurrent()

  async function checkWallet(context: Context) {
    const [accounts, chain] = await inspectWallet(context.provider)
    const first: unknown = Array.isArray(accounts) ? accounts[0] : undefined
    if (!context.isCurrent() || typeof first !== 'string' || !sameAddress(first, context.address) ||
        parseChainId(chain) !== ARC_MAINNET.chain.id) {
      throw new TransferCheckError('The wallet account or network changed. Review again on Arc Mainnet.')
    }
  }

  function failure(error: unknown) {
    store.setState({ quote: null, notice: error instanceof TransferCheckError ? error.message :
      'Arc validation, simulation or local storage failed. No new wallet request was sent.' })
  }

  async function review(amount: string, continueApproval = false) {
    if (handoff || store.getState().busy) return
    clearDraft()
    const context = wallet.getTransferContext()
    if (!context) return failure(new TransferCheckError('Connect a wallet on Arc Mainnet first.'))
    const generation = revision
    store.setState({ busy: true })
    try {
      const record = journal.read(context.address)
      if (observed.has(context.address) || (record && routerUnresolved(record))) {
        throw new TransferCheckError('Resolve the existing router action before starting another payment.')
      }
      if (continueApproval && record?.status !== 'approved') throw new TransferCheckError('No confirmed approval to continue.')
      if (!continueApproval && record?.status === 'approved') {
        throw new TransferCheckError('Continue the approved intent or explicitly end it before creating another one.')
      }
      const local = store.getState()
      if (record?.hash && (!local.verified || !sameRouterRecord(local.record, record))) {
        const evidence = await rpc.verify(record.hash, record.step, routerIntent(record))
        const expected = record.status === 'approved' ? 'confirmed' : record.status
        if (!('block' in evidence) || evidence.status !== expected || evidence.block <= BigInt(record.head)) {
          throw new TransferCheckError('The previous router action could not be verified. Recheck its status.')
        }
      }
      if (!current(context, generation)) return
      if (sameAddress(context.address, ROUTER.recipient)) {
        throw new TransferCheckError('Use a different wallet. The fixed recipient cannot pay itself.')
      }
      const intent = continueApproval && record ? routerIntent(record) : {
        sender: context.address,
        amount: validateTransfer(context.address, ROUTER.recipient, amount).amount,
        reference: reference(),
      }
      if (!isTransactionHash(intent.reference) || intent.amount > ROUTER_AMOUNT_LIMIT) {
        throw new TransferCheckError('The payment reference or amount is out of range.')
      }
      await checkWallet(context)
      const quote = await rpc.quote(intent, continueApproval)
      if (current(context, generation)) {
        reviewed = { wallet: context, record }
        store.setState({ quote })
      }
    } catch (error) {
      if (current(context, generation)) failure(error)
    } finally {
      if (generation === revision) store.setState({ busy: false })
    }
  }

  async function refreshStatus(candidate?: string) {
    const context = wallet.getTransferContext()
    if (!context || handoff || store.getState().busy) return
    const generation = revision
    store.setState({ busy: true, notice: '' })
    try {
      const record = journal.read(context.address)
      if (!record) throw new TransferCheckError('No saved router activity for this wallet.')
      const hash = candidate?.trim().toLowerCase() || observed.get(context.address)?.hash || record.hash
      if (!isTransactionHash(hash)) throw new TransferCheckError('Enter a transaction hash from your wallet to verify it.')
      const outcome = await rpc.verify(hash, record.step, routerIntent(record))
      if (!current(context, generation)) return
      const afterHandoff = 'block' in outcome && outcome.block > BigInt(record.head)
      const exactHash = !!record.hash && sameAddress(record.hash, hash)
      // A different or previously missing hash may only resolve on positive evidence.
      // A revert of an arbitrary alternative hash cannot prove the original attempt failed.
      const status = afterHandoff && outcome.status === 'confirmed'
        ? (record.step === 'approval' ? 'approved' : 'confirmed')
        : afterHandoff && exactHash && outcome.status === 'reverted' ? 'reverted' : undefined
      if (!status) {
        store.setState({
          notice: outcome.status === 'pending' ? 'Awaiting a matching receipt. Check again later.' :
            'No conclusive matching evidence. Check wallet activity before taking any further action.',
        })
        return
      }
      if (!routerUnresolved(record)) {
        if (status !== record.status || !exactHash) throw new TransferCheckError('This hash does not match the recorded result.')
        await exclusive(() => {
          if (current(context, generation) && sameRouterRecord(journal.read(context.address), record)) {
            store.setState({ record, verified: true })
          }
        })
        return
      }
      const saved = await exclusive(() => current(context, generation) ? journal.save({ ...record, status, hash }, record) : null)
      if (saved && current(context, generation)) {
        observed.delete(context.address)
        store.setState({ record: saved, verified: true, volatileHash: null })
        void wallet.refresh()
      }
    } catch (error) {
      if (current(context, generation)) store.setState({ notice: error instanceof TransferCheckError ? error.message :
        'Status could not be verified. Check Arc RPC or browser storage and try again.' })
    } finally {
      if (generation === revision) store.setState({ busy: false })
    }
  }

  async function confirm(quote: RouterQuote) {
    const draft = reviewed
    if (!draft || handoff || store.getState().busy || store.getState().quote !== quote) return
    const { wallet: context, record: previous } = draft
    const generation = ++revision
    reviewed = null
    store.setState({ quote: null, busy: true, notice: '' })
    let reserved: RouterRecord | null = null
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      const latest = await rpc.quote(quote.intent, previous?.status === 'approved')
      if (!current(context, generation)) return
      if (latest.step !== quote.step || latest.feeCap > quote.feeCap || latest.futurePaymentFee > quote.futurePaymentFee) {
        reviewed = draft
        store.setState({ quote: latest, notice: 'The allowance or fee estimate changed. Review this quote before confirming.' })
        return
      }
      const request = await exclusive(async () => {
        if (!current(context, generation) || handoff) return null
        await checkWallet(context)
        if (!current(context, generation) || handoff) return null
        const record = journal.save({
          version: 1, chainId: ARC_MAINNET.chain.id, router: ROUTER.address,
          sender: context.address, reference: latest.intent.reference, amount: latest.intent.amount.toString(),
          head: latest.head.toString(), status: 'awaiting', step: latest.step, hash: null,
          approvalHash: previous?.status === 'approved' ? previous.hash : null,
        }, previous)
        reserved = record
        handoff = true
        store.setState({ record, awaitingWallet: true, verified: false })
        timer = setTimeout(() => {
          store.setState({ awaitingWallet: false })
          if (current(context, generation)) {
            store.setState({ notice: 'Wallet response unknown. Check wallet activity. If the wallet never responds, reload to recheck the saved intent. It will never resend automatically.' })
          }
        }, walletTimeout)
        const response = async () => context.provider.request({
          method: 'eth_sendTransaction',
          params: [{
            chainId: ARC_MAINNET.chainIdHex, from: context.address, to: routerTarget(latest.step),
            data: routerData(latest.step, latest.intent), value: '0x0', type: '0x2',
            gas: toHex(latest.gas), maxFeePerGas: toHex(latest.maxFeePerGas), maxPriorityFeePerGas: '0x0',
          }],
        })
        return { record, response: response().then(value => ({ value }), (error: unknown) => ({ error })) }
      })
      if (!request) return
      const result = await request.response
      clearTimeout(timer)
      if ('error' in result) throw result.error
      if (!isTransactionHash(result.value)) throw new Error('Invalid wallet response')
      const hash = result.value.toLowerCase() as Hash
      const update: RouterRecord = { ...request.record, status: 'pending', hash }
      observed.set(context.address, update)
      const saved = await exclusive(() => journal.save(update, request.record))
      observed.delete(context.address)
      if (current(context, generation)) store.setState({ record: saved })
    } catch (error) {
      const record = reserved as RouterRecord | null
      if (!record) {
        if (current(context, generation)) failure(error)
        return
      }
      const pending = observed.get(context.address)
      const status = providerErrorCode(error) === 4001 && !pending ? 'rejected' : 'unknown'
      try {
        const saved = await exclusive(() => journal.save({ ...record, status, hash: pending?.hash ?? null }, record))
        observed.delete(context.address)
        if (current(context, generation)) store.setState({ record: saved })
      } catch {
        if (current(context, generation)) store.setState({ volatileHash: pending?.hash ?? null })
      }
      if (current(context, generation)) store.setState({ notice: status === 'rejected' ? 'Wallet request declined.' :
        'Wallet outcome or journal write is uncertain. Check wallet activity before continuing.' })
    } finally {
      clearTimeout(timer)
      if (reserved) {
        handoff = false
        store.setState({ awaitingWallet: false })
      }
      if (generation === revision) store.setState({ busy: false })
      else if (reserved) sync()
    }
    if (current(context, generation) && store.getState().record?.status === 'pending') await refreshStatus()
  }

  async function endApprovedIntent() {
    const context = wallet.getTransferContext()
    const record = store.getState().record
    if (!context || handoff || store.getState().busy || record?.status !== 'approved' || !store.getState().verified) return
    clearDraft()
    const generation = revision
    try {
      await exclusive(() => {
        if (current(context, generation)) journal.save({ ...record, status: 'cancelled', approvalHash: null, hash: null }, record)
      })
      if (current(context, generation)) {
        sync()
        store.setState({ notice: 'Intent ended. Any remaining allowance stays in your wallet.' })
      }
    } catch (error) {
      if (current(context, generation)) failure(error)
    }
  }

  return { store, sync, clearDraft, invalidateWallet, review, confirm, refreshStatus, endApprovedIntent }
}

export const routerSession = createRouterSession(walletSession, createRouterRpc(),
  createRouterJournal(() => window.localStorage),
  action => navigator.locks
    ? navigator.locks.request(ROUTER_JOURNAL, action)
    : Promise.reject(new TransferCheckError('Secure browser locking is unavailable. Use a supported browser over HTTPS.')))
export const formatRouterAmount = (record: RouterRecord) => formatUnits(BigInt(record.amount), ARC_MAINNET.usdcDecimals)
