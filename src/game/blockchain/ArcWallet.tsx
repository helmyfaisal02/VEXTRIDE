import { lazy, Suspense, useCallback, useEffect, useId, useRef, useState } from 'react'
import { Wallet } from 'lucide-react'
import { setWalletPanelOpen } from '../input/inputState'
import { useCharacterStore } from '../state/characterStore'
import { useGameStore } from '../state/gameStore'
import { useVehicleStore } from '../vehicles/vehicleState'
import { useGarageStore } from '../garage/garageState'
import { useDialogueStore } from '../interactions/dialogueState'

const ArcWalletContent = lazy(() => import('./ArcWalletContent'))

export interface WalletPanelControls {
  canClose: () => boolean
  cancelDraft: () => void
}

export function ArcWallet() {
  const ready = useGameStore((state) => state.phase === 'ready')
  const creatorOpen = useCharacterStore((state) => state.menuOpen)
  const driving = useVehicleStore((state) => state.driving)
  const garageOpen = useGarageStore((state) => state.open)
  const talking = useDialogueStore((state) => !!state.active)
  const available = ready && !creatorOpen && !driving && !garageOpen && !talking
  const titleId = useId()
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const [activated, setActivated] = useState(false)
  const [open, setOpen] = useState(false)
  const controls = useRef<WalletPanelControls | null>(null)

  const registerControls = useCallback((value: WalletPanelControls | null) => {
    controls.current = value
  }, [])

  useEffect(() => () => setWalletPanelOpen(false), [])

  useEffect(() => {
    if (!available && dialog.current?.open) {
      controls.current?.cancelDraft()
      dialog.current.close()
      setOpen(false)
      setWalletPanelOpen(false)
    }
  }, [available])

  function closePanel() {
    if (controls.current?.canClose() === false) return
    controls.current?.cancelDraft()
    setOpen(false)
    setWalletPanelOpen(false)
    dialog.current?.close()
    trigger.current?.focus()
  }

  return (
    <>
      {available && (
        <button
          ref={trigger}
          type="button"
          aria-haspopup="dialog"
          onClick={() => {
            dialog.current?.showModal()
            setActivated(true)
            setOpen(true)
            setWalletPanelOpen(true)
          }}
          className="pointer-events-auto absolute right-5 top-[8.25rem] flex items-center gap-1.5 rounded-full border border-white/25 bg-[#142440]/90 px-3 py-2 text-xs font-semibold text-white hover:bg-[#243d60] focus-visible:outline focus-visible:outline-2 sm:right-7"
        >
          <Wallet size={14} aria-hidden="true" /> Arc Wallet
        </button>
      )}
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        onCancel={(event) => {
          event.preventDefault()
          closePanel()
        }}
        onClose={() => {
          if (dialog.current?.open) return
          setWalletPanelOpen(false)
          trigger.current?.focus()
        }}
        className="pointer-events-auto max-h-[calc(100%-2rem)] w-[calc(100%-2rem)] max-w-sm overflow-auto rounded-2xl border border-white/20 bg-[#142440] p-5 text-white shadow-2xl backdrop:bg-slate-950/55"
      >
        <div className="flex items-center justify-between gap-4">
          <h2 id={titleId} className="font-display text-lg font-semibold uppercase tracking-wider">Arc Wallet</h2>
          <button type="button" className="rounded-lg bg-white/15 px-3 py-2 text-xs font-semibold hover:bg-white/25 focus-visible:outline focus-visible:outline-2" onClick={closePanel}>Close</button>
        </div>
        {activated && (
          <Suspense fallback={<p role="status" className="mt-4 text-sm">Loading wallet panel…</p>}>
            <ArcWalletContent open={open} registerControls={registerControls} />
          </Suspense>
        )}
      </dialog>
    </>
  )
}
