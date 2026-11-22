import { useEffect, useRef, useState } from 'react'
import { useStore } from 'zustand'
import { formatUnits } from 'viem'
import { ARC_MAINNET } from './arcConfig'
import { ROUTER } from './routerContract'
import { ROUTER_JOURNAL, routerUnresolved } from './routerJournal'
import { sameAddress } from './routerRpc'
import { formatRouterAmount, routerSession as router } from './routerSession'
import { usdcToNative } from './transferValidation'
import { formatUsdc } from './usdcBalance'

const button = 'rounded-lg bg-white/15 px-3 py-2 text-xs font-semibold hover:bg-white/25 focus-visible:outline focus-visible:outline-2 disabled:opacity-50'
const input = 'w-full rounded-lg border border-white/25 bg-black/25 p-2 text-sm text-white focus-visible:outline focus-visible:outline-2'
const native = (amount: bigint) => formatUnits(amount, ARC_MAINNET.chain.nativeCurrency.decimals)
const labels = {
  awaiting: 'Wallet outcome unknown until checked',
  pending: 'Pending verification',
  unknown: 'Unknown · Needs verification',
  approved: 'Allowance approved · Payment still requires confirmation',
  confirmed: 'Payment confirmed on Arc',
  reverted: 'Transaction reverted on Arc',
  rejected: 'Wallet request declined',
  cancelled: 'Approved intent ended',
}

export function RouterPayment({ open, sender, canSend }: {
  open: boolean
  sender: `0x${string}` | null
  canSend: boolean
}) {
  const state = useStore(router.store)
  const [amount, setAmount] = useState('')
  const [candidate, setCandidate] = useState('')
  const [ending, setEnding] = useState(false)
  const reviewHeading = useRef<HTMLHeadingElement>(null)
  const reviewButton = useRef<HTMLButtonElement>(null)
  const record = state.record && sender && sameAddress(state.record.sender, sender) ? state.record : null
  const quote = state.quote
  const unresolved = record && routerUnresolved(record)
  const self = !!sender && sameAddress(sender, ROUTER.recipient)

  useEffect(() => {
    if (!open) return
    router.sync()
    const sync = (event: StorageEvent) => {
      if (event.key === null || event.key.startsWith(ROUTER_JOURNAL + '.')) router.sync()
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [open, sender, canSend])

  useEffect(() => {
    if (quote) reviewHeading.current?.focus()
  }, [quote])

  function cancelReview() {
    router.clearDraft()
    reviewButton.current?.focus()
  }

  return (
    <section aria-label="Fixed-recipient router payment" className="mt-5 min-w-0 space-y-3 border-t border-white/20 pt-4 text-sm">
      <h3 className="font-display text-sm font-semibold uppercase tracking-wider">Router payment</h3>
      <p className="text-xs text-white/80">Send real USDC to the fixed recipient on Arc Mainnet. This payment provides no Street Cash, items or gameplay benefits.</p>
      <dl className="space-y-2 text-xs [overflow-wrap:anywhere]">
        <div><dt>Fixed recipient</dt><dd className="font-mono">{ROUTER.recipient}</dd></div>
        <div><dt>VEXTRIDE router</dt><dd className="font-mono">{ROUTER.address}</dd></div>
      </dl>
      {!canSend && <p role="status">Connect a wallet on Arc Mainnet to use the router.</p>}
      {self && <p role="status" className="text-amber-200">The fixed recipient cannot pay itself. Use a different wallet.</p>}
      {open && canSend && !self && !unresolved && !state.volatileHash && record?.status !== 'approved' && (
        <form className="space-y-2" onSubmit={event => {
          event.preventDefault()
          void router.review(amount)
        }}>
          <label className="block space-y-1">
            <span>Router payment amount in USDC</span>
            <input value={amount} className={input} disabled={state.awaitingWallet} inputMode="decimal" autoComplete="off"
              maxLength={80} onChange={event => { router.clearDraft(); setAmount(event.target.value) }} />
          </label>
          <button ref={reviewButton} type="submit" className={button} disabled={state.busy || state.awaitingWallet}>Review Router Payment</button>
        </form>
      )}

      {canSend && quote && (
        <section aria-label="Router action review" className="space-y-3 rounded-xl border border-white/20 bg-black/20 p-3"
          onKeyDown={event => {
            if (event.key === 'Escape') {
              event.preventDefault()
              cancelReview()
            }
          }}>
          <h4 ref={reviewHeading} tabIndex={-1} className="font-semibold">
            {quote.step === 'approval' ? 'Review exact USDC allowance' : 'Review payment settlement'}
          </h4>
          <dl className="space-y-2 text-xs [overflow-wrap:anywhere]">
            <div><dt>Network</dt><dd>Arc Mainnet (5042)</dd></div>
            <div><dt>Payer</dt><dd className="font-mono">{quote.intent.sender}</dd></div>
            <div><dt>Fixed recipient</dt><dd className="font-mono">{ROUTER.recipient}</dd></div>
            {quote.step === 'approval' && <div><dt>Allowance spender</dt><dd className="font-mono">{ROUTER.address}</dd></div>}
            <div><dt>Payment reference</dt><dd className="font-mono">{quote.intent.reference}</dd></div>
            <div><dt>Payment amount</dt><dd>{formatUsdc(quote.intent.amount)} USDC</dd></div>
            <div><dt>Current router allowance</dt><dd>{formatUsdc(quote.allowance)} USDC</dd></div>
            <div><dt>Gas limit with margin</dt><dd>{quote.gas.toString()}</dd></div>
            <div><dt>Estimated fee cap for this action</dt><dd>{native(quote.feeCap)} USDC</dd></div>
            {quote.step === 'approval'
              ? <div><dt>Provisional reserve for later payment gas</dt><dd>{native(quote.futurePaymentFee)} USDC</dd></div>
              : <div><dt>Payment plus current gas cap</dt><dd>{native(usdcToNative(quote.intent.amount) + quote.feeCap)} USDC</dd></div>}
          </dl>
          <p className="text-xs text-amber-200">{quote.step === 'approval'
            ? 'This approval sets the router allowance to the exact amount above. It costs gas. After it confirms, review and accept a separate payment transaction using a fresh gas estimate.'
            : 'This sends real funds to the fixed recipient above and may be irreversible. Check all details in your wallet.'}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={button} onClick={cancelReview}>Cancel Review</button>
            <button type="button" className={button} onClick={() => void router.confirm(quote)}>
              {quote.step === 'approval' ? 'Request Exact Allowance' : 'Request Wallet Payment'}
            </button>
          </div>
        </section>
      )}

      {state.awaitingWallet && <p role="status">Approve or decline the reviewed action in your wallet.</p>}
      {state.busy && !state.awaitingWallet && <p role="status">Checking router activity…</p>}
      {state.notice && <p role="status" className="text-xs text-amber-200">{state.notice}</p>}

      {canSend && record && (
        <section aria-label="Router activity" className="space-y-2 border-t border-white/20 pt-3">
          <h4 className="font-semibold">Latest router intent</h4>
          <p aria-live="polite" className="text-xs">{['approved', 'confirmed', 'reverted'].includes(record.status) && !state.verified
            ? `Saved status: ${labels[record.status]}. Recheck on Arc.` : labels[record.status]}</p>
          <p className="text-xs">{record.step === 'approval' ? 'Allowance' : 'Payment'} · {formatRouterAmount(record)} USDC</p>
          <p className="break-all font-mono text-xs">Reference {record.reference}</p>
          {record.approvalHash && <a className="block break-all text-xs underline" href={ARC_MAINNET.chain.blockExplorers.default.url + '/tx/' + record.approvalHash}
            target="_blank" rel="noopener noreferrer">Approval {record.approvalHash}</a>}
          {(state.volatileHash ?? record.hash) && <a className="block break-all text-xs underline"
            href={ARC_MAINNET.chain.blockExplorers.default.url + '/tx/' + (state.volatileHash ?? record.hash)}
            target="_blank" rel="noopener noreferrer">Transaction {state.volatileHash ?? record.hash}</a>}
          {unresolved && !state.awaitingWallet && (
            <>
              <p className="text-xs text-white/80">Check wallet activity before trying again. If the wallet shows a replacement or the hash was lost, enter the matching hash below.</p>
              <label className="block space-y-1">
                <span className="text-xs">Recovery transaction hash</span>
                <input className={input} autoComplete="off" spellCheck={false} maxLength={66} value={candidate}
                  onChange={event => setCandidate(event.target.value)} />
              </label>
            </>
          )}
          <div className="flex flex-wrap gap-2">
            {(record.hash || unresolved) && <button type="button" className={button} disabled={state.busy}
              onClick={() => void router.refreshStatus(unresolved ? candidate : undefined)}>Recheck Router Status</button>}
            {record.status === 'approved' && (
              <>
                <button ref={reviewButton} type="button" className={button} disabled={state.busy}
                  onClick={() => void router.review('', true)}>Review Approved Payment</button>
                {state.verified && !ending && <button type="button" className={button} disabled={state.busy} onClick={() => setEnding(true)}>End Approved Intent</button>}
              </>
            )}
          </div>
          {record.status === 'approved' && state.verified && ending && (
            <div className="space-y-2 rounded-lg border border-amber-200/40 p-2 text-xs">
              <p>Ending this intent leaves any unused allowance in your wallet.</p>
              <div className="flex flex-wrap gap-2">
                <button className={button} type="button" onClick={() => setEnding(false)}>Keep Intent</button>
                <button className={button} type="button" onClick={() => { setEnding(false); void router.endApprovedIntent() }}>Confirm End Intent</button>
              </div>
            </div>
          )}
        </section>
      )}
    </section>
  )
}
