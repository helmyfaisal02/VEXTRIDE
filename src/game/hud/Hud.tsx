import { memo, useEffect, useRef, type RefObject } from 'react'
import { UserRound } from 'lucide-react'
import { ArcWallet } from '../blockchain/ArcWallet'
import { resetInput } from '../input/inputState'
import { isGameplayModalOpen } from '../input/gameplayUi'
import { useGarageStore } from '../garage/garageState'
import { useDialogueStore } from '../interactions/dialogueState'
import { isTypingTarget } from '../shared/dom'
import { subscribePerf } from '../shared/perfStats'
import { useCharacterStore } from '../state/characterStore'
import { useGameStore } from '../state/gameStore'
import { CharacterCreator } from './CharacterCreator'
import { WorldTimeHud } from './WorldTimeHud'
import { GuestSaveWarning } from './GuestProgressSettings'
import { EconomyHud } from './EconomyHud'
import { GaragePanel } from './GaragePanel'
import { MissionHud } from './MissionHud'
import { NPCDialogue } from './NPCDialogue'
import { VehicleHud } from './VehicleHud'
import { useVehicleStore } from '../vehicles/vehicleState'

function Brand() {
  return (
    <div className="select-none">
      <h1
        className="font-display text-2xl font-bold uppercase text-white sm:text-3xl"
        style={{ letterSpacing: '0.14em', textShadow: '0 2px 14px rgba(20, 40, 80, 0.45)' }}
      >
        Vextride
      </h1>
    </div>
  )
}

function ControlRow({ keys, label, note }: { keys: string; label: string; note?: string }) {
  return (
    <div className="contents">
      <dt className="font-semibold tabular-nums">{keys}</dt>
      <dd className="m-0">
        {label}
        {note ? <span className="ml-1.5 opacity-60">{note}</span> : null}
      </dd>
    </div>
  )
}

const Controls = memo(function Controls() {
  const physicsDebug = useGameStore((s) => s.physicsDebug)
  const showPerf = useGameStore((s) => s.showPerf)
  const cameraMode = useGameStore((s) => s.cameraMode)
  const creatorOpen = useCharacterStore((s) => s.menuOpen)
  const driving = useVehicleStore((s) => s.driving)

  if (creatorOpen) return null
  const rows = (
    <dl
      className="vex-control-rows m-0 grid grid-cols-[auto_1fr] gap-x-3 px-3 py-2 text-xs"
      style={{ lineHeight: 1.65 }}
    >
      <ControlRow keys="WASD" label={driving ? 'Drive / Steer' : 'Move'} />
      {!driving && <ControlRow keys="Shift" label="Sprint" />}
      <ControlRow keys="Space" label={driving ? 'Handbrake' : 'Jump'} />
      <ControlRow keys="E" label={driving ? 'Exit when stopped' : 'Interact'} />
      <ControlRow keys="Mouse Drag" label="Camera" />
      <ControlRow keys="Scroll" label="Zoom" />
      <ControlRow keys="F" label="Performance" note={showPerf ? 'on' : 'off'} />
      <ControlRow keys="P" label="Physics Debug" note={physicsDebug ? 'on' : 'off'} />
      <ControlRow keys="C" label="Debug Camera" note={cameraMode === 'orbit' ? 'on' : 'off'} />
      {import.meta.env.DEV && <ControlRow keys="Shift T" label="Time Controls" />}
    </dl>
  )
  return (
    <div className="vex-controls">
      <div className="vex-control-card vex-controls-wide">{rows}</div>
      <details className="vex-control-card vex-controls-compact">
        <summary className="cursor-pointer px-3 py-2 text-xs font-semibold">Controls</summary>
        {rows}
      </details>
    </div>
  )

})

/** Measured stats. Updates its own DOM node, so it causes no React renders. */
function PerfReadout() {
  const showPerf = useGameStore((s) => s.showPerf)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showPerf) return
    return subscribePerf((s) => {
      if (!ref.current) return
      ref.current.textContent = `${s.fps.toFixed(0)} fps  ${s.frameMs.toFixed(1)} ms  ${s.drawCalls} calls  ${(s.triangles / 1000).toFixed(1)}k tris`
    })
  }, [showPerf])

  if (!showPerf) return null
  return (
    <div
      ref={ref}
      className="rounded-xl bg-[#1B3158]/90 px-3 py-2 font-mono text-xs tabular-nums text-white"
    >
      measuring...
    </div>
  )
}

/** Small in-game entry point to reopen the character creator. */
const CharacterButton = memo(function CharacterButton({ trigger }: { trigger: RefObject<HTMLButtonElement> }) {
  const driving = useVehicleStore((s) => s.driving)
  const name = useCharacterStore((s) => s.settings.name)
  const open = useCharacterStore((s) => s.menuOpen)
  const openMenu = useCharacterStore((s) => s.openMenu)
  return (
    <button
      type="button"
      disabled={driving}
      title={driving ? 'Exit vehicle to edit character' : 'Edit character'}
      ref={trigger}
      aria-haspopup="dialog"
      onClick={openMenu}
      aria-label={`Edit character: ${name}`}
      className={`pointer-events-auto flex min-h-11 max-w-full select-none items-center gap-2 rounded-full border border-white/50 bg-white/80 px-3 py-2 text-xs font-semibold text-[#1B3158] shadow-[0_8px_30px_rgba(27,49,88,0.18)] backdrop-blur-md transition-colors hover:bg-white disabled:opacity-75 ${open ? 'invisible' : ''}`}
    >
      <UserRound size={16} aria-hidden="true" />
      <span className="min-w-0 truncate">{name}</span>
    </button>
  )
})

function WorldInteractionHint() {
  const npcHint = useDialogueStore(s => s.hint)
  const garageHint = useGarageStore(s => s.hint)
  const hint = npcHint || garageHint
  return hint ? <p className="rounded-xl bg-[#142440]/95 px-4 py-2 text-xs text-white" data-testid={npcHint ? 'npc-hint' : 'garage-hint'}>{hint}</p> : null
}

function LoadingVeil() {
  const phase = useGameStore((s) => s.phase)
  return (
    <div
      aria-hidden={phase === 'ready'}
      className={`pointer-events-none absolute inset-0 flex items-center justify-center bg-[#223a63] transition-opacity duration-500 ${
        phase === 'ready' ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <p
        className="font-display text-sm font-semibold uppercase text-white/80"
        style={{ letterSpacing: '0.2em' }}
      >
        Loading world
      </p>
    </div>
  )
}

/** Keyboard toggles for debug overlays. Listener is removed on unmount. */
function useDebugHotkeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isGameplayModalOpen() || e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
      // Letters typed into the name field must never trigger debug shortcuts.
      if (isTypingTarget(e.target)) return
      const store = useGameStore.getState()
      if (e.code === 'KeyP') store.togglePhysicsDebug()
      else if (e.code === 'KeyF') store.togglePerf()
      else if (e.code === 'KeyC') store.toggleCameraMode()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

export function Hud() {
  useDebugHotkeys()
  const creatorOpen = useCharacterStore(s => s.menuOpen)
  const talking = useDialogueStore(s => !!s.active)
  const garageOpen = useGarageStore(s => s.open)
  const characterTrigger = useRef<HTMLButtonElement>(null)
  const modalOpen = creatorOpen || talking || garageOpen

  return (
    <div className="vex-hud pointer-events-none absolute inset-0 overflow-hidden" onFocusCapture={resetInput}>
      <div {...(modalOpen ? { inert: '' } : {})}>
        <div className="vex-hud-top">
          <div className="vex-hud-info">
            <Brand />
            <WorldTimeHud />
            <EconomyHud />
            <MissionHud />
          </div>
          <div className="vex-hud-actions">
            <CharacterButton trigger={characterTrigger} />
            <ArcWallet />
            <PerfReadout />
            <GuestSaveWarning />
          </div>
        </div>
        {!modalOpen && (
          <div className="vex-hud-bottom">
            <Controls />
            <div className="vex-hud-feedback">
              <VehicleHud />
              <WorldInteractionHint />
            </div>
          </div>
        )}
      </div>
      <NPCDialogue />
      <GaragePanel />
      {creatorOpen && <CharacterCreator returnFocus={characterTrigger} />}
      <LoadingVeil />
    </div>
  )
}
