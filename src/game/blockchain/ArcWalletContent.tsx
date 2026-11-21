import { useEffect, useRef, useState } from 'react'
import { useStore } from 'zustand'
import { ARC_MAINNET } from './arcConfig'
import { formatUsdc } from './usdcBalance'
import { injectedWallet } from './walletProvider'
import { walletSession } from './walletSession'
import { transferSession } from './transferSession'
import { SendUsdc } from './SendUsdc'
import type { WalletPanelControls } from './ArcWallet'

const action = 'rounded-lg bg-white/15 px-3 py-2 text-xs font-semibold hover:bg-white/25 focus-visible:outline focus-visible:outline-2 disabled:opacity-50'
const statusText = {
  disconnected: 'Disconnected',
  connecting: 'Connecting to wallet…',
  missing: 'No compatible browser wallet detected.',
  rejected: 'Wallet connection declined.',
  error: 'Could not connect to the wallet. Try again.',
}

export default function ArcWalletContent({ open, registerControls }: {
  open: boolean
  registerControls: (controls: WalletPanelControls | null) => void
}) {
  const state = useStore(walletSession.store)
  const awaitingWallet = useStore(transferSession.store, state => state.status === 'wallet')
  const copyGeneration = useRef(0)
  const [copyFeedback, setCopyFeedback] = useState<{ address: string; text: string }>()
  const onArc = state.chainId === ARC_MAINNET.chain.id
  const address = state.address
  const network = onArc ? ARC_MAINNET.label : state.chainId === 5042002 ? 'Arc Testnet'
    : state.chainId === 1 ? 'Ethereum Mainnet' : `Chain ${state.chainId}`

  useEffect(() => {
    registerControls({
      canClose: () => transferSession.store.getState().status !== 'wallet',
      cancelDraft: () => transferSession.clearDraft(),
    })
    const unsubscribe = walletSession.store.subscribe((next, previous) => {
      if (next.address !== previous.address || next.chainId !== previous.chainId ||
          next.connection !== previous.connection) transferSession.invalidateWallet()
    })
    return () => {
      registerControls(null)
      unsubscribe()
      transferSession.clearDraft()
      walletSession.disconnect()
    }
  }, [registerControls])

  async function copyAddress(value: string) {
    const generation = ++copyGeneration.current
    let text = 'Could not copy the address.'
    try {
      await navigator.clipboard.writeText(value)
      text = 'Address copied.'
    } catch { /* Clipboard access can be blocked by the browser. */ }
    if (copyGeneration.current === generation && walletSession.store.getState().address === value) {
      setCopyFeedback({ address: value, text })
    }
  }

  return (
    <>
    <p className="mt-3 text-xs text-white/75">USDC is separate from Street Cash.</p>
    <p role="status" className="mt-4 text-sm font-medium">
      {state.connection === 'connected' ? (onArc ? 'Connected to Arc Mainnet' : 'Wrong network') : statusText[state.connection]}
    </p>
    {address && (
      <div className="mt-3 space-y-3 text-sm">
        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-5 gap-y-2">
          <dt className="text-white/70">Address</dt>
          <dd className="m-0 font-mono">{address.slice(0, 6)}…{address.slice(-4)}</dd>
          <dt className="text-white/70">Network</dt>
          <dd className="m-0">{network} ({state.chainId})</dd>
          <dt className="text-white/70">USDC balance</dt>
          <dd className="m-0 break-all tabular-nums" aria-live="polite">
            {!onArc ? 'Arc Mainnet required'
              : state.balanceStatus === 'loading' ? 'Loading balance…'
              : state.balanceStatus === 'unavailable' ? 'Arc RPC unavailable'
              : state.balance !== null ? `${formatUsdc(state.balance)} USDC` : 'Awaiting balance'}
          </dd>
        </dl>
        {!onArc && <p className="text-xs text-white/75">Select Arc Mainnet (5042) to read your USDC balance.</p>}
        {state.networkNotice && <p role="status" className="text-sm text-amber-200">{state.networkNotice}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" className={action} onClick={() => void copyAddress(address)}>Copy address</button>
          {onArc ? (
            <button type="button" className={action} disabled={state.balanceStatus === 'loading'} onClick={() => void walletSession.refresh()}>Refresh balance</button>
          ) : (
            <button type="button" className={action} disabled={state.requestPending} onClick={() => void walletSession.switchNetwork()}>Switch to Arc Mainnet</button>
          )}
        </div>
        {copyFeedback?.address === address && <p role="status" className="text-xs">{copyFeedback.text}</p>}
        <p className="text-xs text-white/75">Disconnect ends this game’s session. Your wallet may keep site permissions.</p>
      </div>
    )}
    <div className="mt-4">
      {state.connection === 'connected' || state.connection === 'connecting' ? (
        <button type="button" className={action} disabled={awaitingWallet} onClick={walletSession.disconnect}>Disconnect</button>
      ) : (
        <button type="button" className={action} disabled={state.requestPending} onClick={() => void walletSession.connect(injectedWallet())}>Connect Wallet</button>
      )}
    </div>
    <SendUsdc open={open} canSend={onArc && !!address && !state.requestPending}
      walletKey={address} balance={state.balance} />
    </>
  )
}
