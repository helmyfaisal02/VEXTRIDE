import { toHex, type Hash } from 'viem'
import { createStore } from 'zustand/vanilla'
import { ARC_MAINNET, parseChainId } from './arcConfig'
import { createTransferRpc, transferData, type TransferQuote } from './transferRpc'
import { isTransactionHash, TransferCheckError, validateTransfer, type TransferIntent } from './transferValidation'
import { inspectWallet, providerErrorCode } from './walletProvider'
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

export function createTransferSession(wallet: Wallet, rpc: ReturnType<typeof createTransferRpc>, walletTimeout = 90_000) {
  const store = createStore<TransferState>(() => initial)
  let revision = 0
  let submissionIntent: TransferIntent | null = null
  let reviewedContext: ReturnType<Wallet['getTransferContext']> = null

  function locked() {
    const { status, hash } = store.getState()
    return status === 'wallet' || status === 'submitted' || status === 'pending' ||
      status === 'unknown' || (status === 'rpc-error' && hash !== null)
  }

  function clearDraft() {
    if (locked()) return
    revision++
    reviewedContext = null
    submissionIntent = null
    store.setState(initial)
  }

  function invalidateWallet() {
    // An outstanding handoff can still return a hash on its original chain.
    if (!locked()) clearDraft()
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

  async function refreshStatus() {
    const { hash, checking, status } = store.getState()
    const intent = submissionIntent
    if (!hash || !intent || checking || status === 'confirmed' || status === 'reverted') return
    store.setState({ checking: true })
    try {
      const outcome = await rpc.receipt(hash, intent)
      store.setState({
        status: outcome,
        message: outcome === 'unknown' ? 'Arc returned a receipt that could not verify this transfer. Check the explorer.' : '',
      })
      if (outcome === 'confirmed' || outcome === 'reverted') {
        submissionIntent = null
        void wallet.refresh()
      }
    } catch {
      store.setState({ status: 'rpc-error', message: 'Receipt unavailable. The transaction may still be pending. Check again or use the explorer.' })
    } finally {
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

    // Consume the review before handing off. An account change or a timeout
    // cannot authorize another send. The returned hash still belongs to this intent.
    submissionIntent = intent
    store.setState({ status: 'wallet' })
    const timer = setTimeout(() => {
      store.setState({
        status: 'unknown',
        message: 'The wallet has not returned a hash. Check wallet activity before attempting another transfer.',
      })
    }, walletTimeout)
    try {
      const result = await context.provider.request({
        method: 'eth_sendTransaction',
        params: [{
          chainId: ARC_MAINNET.chainIdHex, from: intent.sender,
          to: ARC_MAINNET.usdcAddress, data: transferData(intent), value: '0x0',
          type: '0x2', gas: toHex(latest.gas), maxFeePerGas: toHex(latest.maxFeePerGas),
          maxPriorityFeePerGas: '0x0',
        }],
      })
      if (!isTransactionHash(result)) throw new Error('Invalid transaction hash')
      store.setState({ status: 'submitted', hash: result, message: '' })
      void refreshStatus()
    } catch (error) {
      if (providerErrorCode(error) === 4001) {
        submissionIntent = null
        store.setState({ status: 'rejected', message: 'The wallet declined this transfer. A new review is required to try again.' })
      } else {
        store.setState({
          status: 'unknown',
          message: 'No valid hash was returned. Check wallet activity before attempting another transfer.',
        })
      }
    } finally {
      clearTimeout(timer)
    }
  }

  return { store, clearDraft, invalidateWallet, review, confirm, refreshStatus, locked }
}

export const transferSession = createTransferSession(walletSession, createTransferRpc())
