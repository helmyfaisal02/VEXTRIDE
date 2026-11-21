import { useEffect, useRef, useState } from 'react'
import { useStore } from 'zustand'
import type { Address } from 'viem'
import { ARC_MAINNET } from './arcConfig'
import { transferRpc, transferSession as transfer } from './transferSession'
import { forAccount, isUnresolved, TRANSFER_KEY, verificationKey, type TransferRecord } from './transferHistory'
import { isTransactionHash } from './transferValidation'
import type { Observation } from './transferVerification'
import { formatUsdc } from './usdcBalance'

const button = 'rounded-lg bg-white/15 px-3 py-2 text-xs font-semibold focus-visible:outline focus-visible:outline-2 disabled:opacity-50'
const field = 'min-w-0 w-full rounded-lg border border-white/25 bg-black/25 p-2 text-white'
const labels = {
  awaiting: 'Awaiting wallet', submitted: 'Submitted', pending: 'Pending', confirmed: 'Confirmed',
  reverted: 'Reverted', rejected: 'User rejected', unknown: 'Unknown', unavailable: 'Verification unavailable',
}

function Explorer({ hash }: { hash: string }) {
  if (!isTransactionHash(hash)) return null
  return <a className="text-sky-200 underline" href={`${ARC_MAINNET.chain.blockExplorers.default.url}/tx/${hash}`}
    target="_blank" rel="noopener noreferrer">View on Explorer</a>
}

export function TransferActivity({ sender, onArc, open }: { sender: Address | null; onArc: boolean; open: boolean }) {
  const { records, warning, verified } = useStore(transfer.history.store)
  const checking = useStore(transfer.store, state => state.checking)
  const awaiting = useStore(transfer.store, state => state.status === 'wallet')
  const own = forAccount(records, sender)
  const recoverable = own.find(item => item.hash && isUnresolved(item))?.id

  useEffect(() => {
    if (!open) return
    transfer.history.sync()
    const sync = (event: StorageEvent) => {
      if (event.key === TRANSFER_KEY || event.key === null) transfer.history.sync()
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [open])

  useEffect(() => {
    if (!open || !onArc || !recoverable) return
    const timers = [300, 4500, 12000].map(delay => setTimeout(() => void transfer.refreshStatus(recoverable), delay))
    return () => timers.forEach(clearTimeout)
  }, [open, onArc, recoverable])

  return (
    <section aria-label="Recent USDC transfers" className="mt-5 space-y-3 border-t border-white/20 pt-4 text-xs">
      <h3 className="font-display text-sm font-semibold uppercase tracking-wider">Recent USDC transfers</h3>
      <p className="text-white/75">Outgoing transfers started in VEXTRIDE and saved in this browser profile.</p>
      {warning && <p role="status" className="text-amber-200">{warning}</p>}
      {!sender && <p>Connect the sending wallet to see its saved transfers.</p>}
      {sender && !onArc && <p>Switch to Arc Mainnet to resume checking transfers.</p>}
      {sender && own.length === 0 && <p>No saved transfers for this account.</p>}
      {sender && own.length > 0 && (
        <ul className="max-h-72 space-y-2 overflow-auto pr-1">
          {[...own].reverse().map(record => (
            <ActivityRow key={record.id} record={record} canCheck={open && onArc && !checking}
              awaiting={awaiting} verified={verified[record.id] === verificationKey(record)} />
          ))}
        </ul>
      )}
      {open && <HashLookup />}
    </section>
  )
}

function ActivityRow({ record, canCheck, awaiting, verified }: { record: TransferRecord; canCheck: boolean; awaiting: boolean; verified: boolean }) {
  const [candidate, setCandidate] = useState('')
  const [feedback, setFeedback] = useState('')
  const alive = useRef(false)
  useEffect(() => {
    alive.current = true
    return () => { alive.current = false }
  }, [])
  const status = record.status === 'awaiting' && !awaiting ? 'unknown' : record.status
  const unresolved = isUnresolved(record)

  async function check() {
    const accepted = await transfer.refreshStatus(record.id, candidate)
    if (!alive.current) return
    setFeedback(accepted ? '' : record.hash
      ? 'Verification is unavailable. Check again or use the explorer.'
      : 'This hash did not verify the original transfer. Check wallet activity for a matching mined hash.')
  }

  return (
    <li className="space-y-2 rounded-xl border border-white/15 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <strong className={status === 'confirmed' ? 'text-emerald-200' : 'text-white'}>
          {!unresolved && status !== 'rejected' ? (verified ? 'Verified · ' : 'Saved · ') : ''}{labels[status]}
        </strong>
        <time dateTime={new Date(record.createdAt).toISOString()}>{new Date(record.createdAt).toLocaleString()}</time>
      </div>
      <p>{formatUsdc(BigInt(record.amount))} USDC · Arc Mainnet (5042)</p>
      <p className="break-all font-mono">To {record.recipient}</p>
      {record.hash && <><p className="break-all font-mono">{record.hash}</p><Explorer hash={record.hash} /></>}
      {record.block && <p>Block {record.block}{record.logIndex !== null && ` · Log ${record.logIndex}`}</p>}
      {record.checkedAt !== null && <p className="text-white/70">Last checked {new Date(record.checkedAt).toLocaleString()}</p>}
      {status === 'unknown' && !record.hash && (
        <div className="space-y-2 text-amber-100">
          <p>The wallet may have submitted this transfer. Check wallet activity before sending again.</p>
          <label className="block">Matching mined transaction hash
            <input className={field} value={candidate} maxLength={66} onChange={e => setCandidate(e.target.value)} spellCheck={false} />
          </label>
          <button type="button" className={button} disabled={!canCheck || !isTransactionHash(candidate.trim())}
            onClick={() => void check()}>Verify and recover</button>
        </div>
      )}
      {record.hash && (
        <div className="space-y-2">
          {unresolved && <p className="text-white/75">Payment remains unverified. Check the original hash or inspect wallet activity for a replacement.</p>}
          <button type="button" className={button} disabled={!canCheck} onClick={() => void check()}>Refresh Status</button>
        </div>
      )}
      {feedback && <p role="status" className="text-amber-200">{feedback}</p>}
    </li>
  )
}

function HashLookup() {
  const [value, setValue] = useState('')
  const [result, setResult] = useState<{ hash: `0x${string}`; observation: Observation }>()
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const revision = useRef({ request: 0 })
  useEffect(() => {
    const identity = revision.current
    return () => { identity.request++ }
  }, [])

  async function inspect() {
    const hash = value.trim()
    if (busy || !isTransactionHash(hash)) return
    const identity = revision.current
    const current = ++identity.request
    setBusy(true)
    setResult(undefined)
    setMessage('')
    try {
      const observation = await transferRpc.inspect(hash)
      if (identity.request === current) setResult({ hash, observation })
    } catch {
      if (identity.request === current) setMessage('Arc verification is unavailable. Try again later.')
    } finally {
      if (identity.request === current) setBusy(false)
    }
  }

  return (
    <form className="space-y-2 border-t border-white/20 pt-3" onSubmit={event => { event.preventDefault(); void inspect() }}>
      <label className="block space-y-1">
        <strong>Inspect an Arc transaction hash</strong>
        <input className={field} value={value} disabled={busy} maxLength={66} spellCheck={false}
          onChange={e => { setValue(e.target.value); setResult(undefined); setMessage('') }} />
      </label>
      <button type="submit" className={button} disabled={busy || !isTransactionHash(value.trim())}>Inspect Hash</button>
      {busy && <p role="status">Checking Arc Mainnet…</p>}
      {message && <p role="status">{message}</p>}
      {result && (
        <div className="space-y-2 rounded-xl border border-white/15 p-3" aria-live="polite">
          {'transaction' in result.observation ? (
            <>
              <p>Arc receipt {result.observation.status === 'confirmed' ? 'succeeded' : 'reverted'} · Block {result.observation.block.toString()}</p>
              <p className="break-all">Transaction sender {result.observation.sender}</p>
              <p className="break-all">Transaction destination {result.observation.to ?? 'Contract creation'}</p>
              {result.observation.movements.length === 0
                ? <p>No matching USDC ERC-20 event was observed.</p>
                : <ul className="space-y-1">{result.observation.movements.map(log => (
                  <li key={log.logIndex} className="break-all">Log {log.logIndex} · {formatUsdc(log.amount)} USDC from {log.sender} to {log.recipient}</li>
                ))}</ul>}
            </>
          ) : <p>{result.observation.status === 'pending' ? 'No mined receipt is available for this hash.' : 'The RPC data could not verify this hash.'}</p>}
          <p className="text-white/70">Public Arc data. This lookup does not add to your outgoing history.</p>
          <Explorer hash={result.hash} />
        </div>
      )}
    </form>
  )
}
