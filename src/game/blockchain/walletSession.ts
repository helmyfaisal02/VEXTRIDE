import { getAddress, isAddress, type Address } from 'viem'
import { createStore } from 'zustand/vanilla'
import { ARC_MAINNET, parseChainId } from './arcConfig'
import { readArcUsdc } from './usdcBalance'
import { inspectWallet, providerErrorCode, type WalletProvider } from './walletProvider'

interface WalletState {
  connection: 'disconnected' | 'connecting' | 'connected' | 'missing' | 'rejected' | 'error' | 'timeout'
  address: Address | null
  chainId: number | null
  balanceStatus: 'idle' | 'loading' | 'ready' | 'unavailable'
  balance: bigint | null
  requestPending: boolean
  networkNotice: string
}

const initialState: WalletState = {
  connection: 'disconnected',
  address: null,
  chainId: null,
  balanceStatus: 'idle',
  balance: null,
  requestPending: false,
  networkNotice: '',
}

export function createWalletSession(readBalance = readArcUsdc, consentTimeout = 30_000) {
  const store = createStore<WalletState>(() => initialState)
  let provider: WalletProvider | null = null
  let removeListeners: (() => void) | undefined
  let revision = 0
  let requestPending = false
  let consentTimer: ReturnType<typeof setTimeout> | undefined

  function clearConsentTimer() {
    clearTimeout(consentTimer)
    consentTimer = undefined
  }

  function reset(connection: WalletState['connection']) {
    revision++
    provider = null
    clearConsentTimer()
    removeListeners?.()
    removeListeners = undefined
    store.setState({ ...initialState, connection, requestPending })
  }

  const disconnect = () => reset('disconnected')

  async function refresh() {
    const { address, chainId, balanceStatus, connection } = store.getState()
    if (connection !== 'connected' || !address || chainId !== ARC_MAINNET.chain.id || balanceStatus === 'loading') return
    const current = revision
    store.setState({ balanceStatus: 'loading', balance: null })
    try {
      const balance = await readBalance(address)
      if (current === revision) store.setState({ balanceStatus: 'ready', balance })
    } catch {
      if (current === revision) store.setState({ balanceStatus: 'unavailable', balance: null })
    }
  }

  async function sync(activeProvider: WalletProvider) {
    if (activeProvider !== provider) return
    const current = ++revision
    store.setState({
      connection: 'connecting', address: null, chainId: null,
      balance: null, balanceStatus: 'idle', networkNotice: '',
    })
    try {
      const [accounts, chain] = await inspectWallet(activeProvider)
      if (current !== revision) return
      if (!Array.isArray(accounts)) return reset('error')
      if (accounts.length === 0) return disconnect()
      const account: unknown = accounts[0]
      const chainId = parseChainId(chain)
      if (typeof account !== 'string' || !isAddress(account) || chainId === null) return reset('error')
      store.setState({ connection: 'connected', address: getAddress(account), chainId })
      void refresh()
    } catch {
      if (current === revision) reset('error')
    }
  }

  function finishRequest() {
    clearConsentTimer()
    requestPending = false
    store.setState({ requestPending })
  }

  async function connect(selected: WalletProvider | null) {
    if (requestPending || provider) return
    if (!selected) return reset('missing')
    requestPending = true
    const current = ++revision
    store.setState({ ...initialState, connection: 'connecting', requestPending })
    // A timed-out extension prompt can still be open. Ignore its eventual
    // approval and keep the duplicate-prompt guard until it actually settles.
    consentTimer = setTimeout(() => {
      if (current === revision) reset('timeout')
    }, consentTimeout)
    try {
      await selected.request({ method: 'eth_requestAccounts' })
      if (current !== revision) return
      clearConsentTimer()
      provider = selected
      const changed = () => { void sync(selected) }
      const disconnected = () => { if (provider === selected) disconnect() }
      const listeners = [
        ['accountsChanged', changed], ['chainChanged', changed], ['disconnect', disconnected],
      ] as const
      removeListeners = () => {
        for (const [event, listener] of listeners) {
          try { selected.removeListener(event, listener) } catch { /* Continue cleaning up an inconsistent provider. */ }
        }
      }
      for (const [event, listener] of listeners) selected.on(event, listener)
      await sync(selected)
    } catch (error) {
      if (provider === selected || current === revision) {
        reset(providerErrorCode(error) === 4001 ? 'rejected' : 'error')
      }
    } finally {
      finishRequest()
    }
  }

  async function switchNetwork() {
    const activeProvider = provider
    const { connection, chainId } = store.getState()
    if (!activeProvider || requestPending || connection !== 'connected' || chainId === ARC_MAINNET.chain.id) return
    requestPending = true
    const current = revision
    store.setState({ requestPending, networkNotice: '' })
    consentTimer = setTimeout(() => {
      if (provider === activeProvider) {
        store.setState({ networkNotice: 'Wallet network request is still open. Finish or dismiss it in your wallet.' })
      }
    }, consentTimeout)
    try {
      await activeProvider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: ARC_MAINNET.chainIdHex }],
      })
      clearConsentTimer()
      // Wallets normally emit chainChanged; inspect explicitly when they do not.
      if (current === revision) await sync(activeProvider)
      if (provider === activeProvider && store.getState().connection === 'connected' &&
          store.getState().chainId !== ARC_MAINNET.chain.id) {
        store.setState({ networkNotice: 'Select Arc Mainnet in your wallet.' })
      }
    } catch (error) {
      if (current !== revision) return
      const code = providerErrorCode(error)
      const networkNotice = code === 4001 ? 'Network switch declined.'
        : code === 4902 ? 'Add Arc Mainnet in your wallet, then select it.'
        : 'This wallet could not switch networks. Select Arc Mainnet in your wallet.'
      store.setState({ networkNotice })
    } finally {
      finishRequest()
    }
  }

  function getTransferContext() {
    const activeProvider = provider
    const { connection, address, chainId } = store.getState()
    if (!activeProvider || !address || connection !== 'connected' || requestPending ||
        chainId !== ARC_MAINNET.chain.id) return null
    const current = revision
    return { provider: activeProvider, address, isCurrent: () => current === revision }
  }

  return { store, connect, disconnect, refresh, switchNetwork, getTransferContext }
}

export const walletSession = createWalletSession()
