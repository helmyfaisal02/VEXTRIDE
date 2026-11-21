import { useEffect, useState } from 'react'
import { useStore } from 'zustand'
import { formatUnits } from 'viem'
import { ARC_MAINNET } from './arcConfig'
import { formatUsdc } from './usdcBalance'
import { transferSession as transfer } from './transferSession'
import { usdcToNative } from './transferValidation'

const action = 'rounded-lg bg-white/15 px-3 py-2 text-xs font-semibold hover:bg-white/25 focus-visible:outline focus-visible:outline-2 disabled:opacity-50'
const input = 'w-full rounded-lg border border-white/25 bg-black/25 p-2 text-sm text-white focus-visible:outline focus-visible:outline-2'
const native = (value: bigint) => formatUnits(value, ARC_MAINNET.chain.nativeCurrency.decimals)
const labels = {
  idle: '', validating: 'Validating transfer…', review: 'Ready for review', wallet: 'Awaiting wallet confirmation',
  rejected: 'User rejected', submitted: 'Submitted', pending: 'Pending confirmation',
  confirmed: 'Confirmed', reverted: 'Reverted', 'rpc-error': 'Validation or RPC error',
  unknown: 'Status unknown · Needs verification',
}

export function SendUsdc({ canSend, open, walletKey, balance }: {
  canSend: boolean
  open: boolean
  walletKey: string | null
  balance: bigint | null
}) {
  const state = useStore(transfer.store)
  useEffect(() => {
    if (!open || state.status !== 'pending' || !state.hash) return
    // Bound automatic checks and scope them to an open panel and this hash.
    const timers = [4000, 10000, 20000].map(delay => setTimeout(() => void transfer.refreshStatus(), delay))
    return () => timers.forEach(clearTimeout)
  }, [open, state.hash, state.status])

  const locked = transfer.locked()
  const quote = state.quote
  const explorer = ARC_MAINNET.chain.blockExplorers.default.url

  return (
    <section aria-label="Send USDC" className="mt-5 space-y-3 border-t border-white/20 pt-4 text-sm">
      <h3 className="font-display text-sm font-semibold uppercase tracking-wider">Send USDC</h3>
      {!canSend && !locked && <p className="text-xs text-white/75">Connect a wallet on Arc Mainnet to send USDC.</p>}
      {open && canSend && !locked && (
        <TransferForm key={walletKey} available={quote?.available ?? balance} busy={state.status === 'validating'} />
      )}
      {state.status !== 'idle' && <p role="status" className="font-medium">{labels[state.status]}</p>}
      {state.message && <p role="status" className="text-xs text-amber-200">{state.message}</p>}
      {canSend && quote && state.status === 'review' && (
        <div aria-label="Transfer review" className="min-w-0 space-y-3 rounded-xl border border-white/20 bg-black/20 p-3">
          <dl className="space-y-2 text-xs">
            <div><dt>Network</dt><dd>Arc Mainnet (5042)</dd></div>
            <div><dt>Sender</dt><dd className="break-all font-mono">{quote.intent.sender}</dd></div>
            <div><dt>Recipient</dt><dd className="break-all font-mono">{quote.intent.recipient}</dd></div>
            <div><dt>Amount</dt><dd className="break-all">{formatUsdc(quote.intent.amount)} USDC</dd></div>
            <div><dt>Estimated network fee (cap)</dt><dd>{native(quote.fee)} USDC</dd></div>
            <div><dt>Total estimated debit (cap)</dt><dd className="break-all">{native(usdcToNative(quote.intent.amount) + quote.fee)} USDC</dd></div>
          </dl>
          <p className="text-xs text-amber-200">Blockchain transfers may be irreversible. Verify the full recipient. Your wallet will ask for separate approval.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={action} onClick={transfer.clearDraft}>Cancel</button>
            <button type="button" className={action} onClick={() => void transfer.confirm(quote)}>Confirm Transfer</button>
          </div>
        </div>
      )}
      {state.hash && (
        <div className="space-y-2">
          <p className="break-all font-mono text-xs">{state.hash}</p>
          <a className="inline-block text-xs text-sky-200 underline" href={`${explorer}/tx/${state.hash}`} target="_blank" rel="noopener noreferrer">Open in Arc Explorer</a>
          {locked && <div><button type="button" className={action} disabled={state.checking} onClick={() => void transfer.refreshStatus()}>Refresh transaction status</button></div>}
        </div>
      )}
      {state.status === 'wallet' && <p className="text-xs text-white/75">Approve or reject the request in your wallet.</p>}
      {(state.status === 'confirmed' || state.status === 'reverted' || state.status === 'rejected') && canSend &&
        <button type="button" className={action} onClick={transfer.clearDraft}>Clear transfer status</button>}
    </section>
  )
}


function TransferForm({ available, busy }: { available: bigint | null; busy: boolean }) {
  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')

  return (
    <form className="space-y-3" onSubmit={event => {
      event.preventDefault()
      void transfer.review(recipient, amount)
    }}>
      <label className="block space-y-1">
        <span>Recipient address</span>
        <input className={input} value={recipient} autoComplete="off" autoCapitalize="none" spellCheck={false}
          maxLength={80} onChange={event => { transfer.clearDraft(); setRecipient(event.target.value) }} />
      </label>
      <label className="block space-y-1">
        <span>Amount in USDC</span>
        <input className={input} value={amount} inputMode="decimal" autoComplete="off" maxLength={80}
          onChange={event => { transfer.clearDraft(); setAmount(event.target.value) }} />
      </label>
      <p className="break-all text-xs text-white/75">Available balance {available !== null ? formatUsdc(available) + ' USDC' : 'unavailable'}</p>
      <button type="submit" className={action} disabled={busy}>Review Transfer</button>
    </form>
  )
}
