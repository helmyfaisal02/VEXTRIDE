import { memo, useEffect, useRef } from 'react'
import { UserRound } from 'lucide-react'
import { isTypingTarget } from '../shared/dom'
import { subscribePerf } from '../shared/perfStats'
import { useCharacterStore } from '../state/characterStore'
import { useGameStore } from '../state/gameStore'
import { CharacterCreator } from './CharacterCreator'
import { WorldTimeHud } from './WorldTimeHud'
import { NPCDialogue } from './NPCDialogue'
import { VehicleHud } from './VehicleHud'
import { useVehicleStore } from '../vehicles/vehicleState'

function Brand() {
  return (
    <div className="pointer-events-none absolute left-5 top-5 select-none sm:left-7 sm:top-6">
      <h1
        className="font-display text-2xl font-bold uppercase text-white sm:text-3xl"
        style={{ letterSpacing: '0.14em', textShadow: '0 2px 14px rgba(20, 40, 80, 0.45)' }}
      >
        Vextride
      </h1>
      <p
        className="mt-1 text-[11px] font-medium uppercase text-white/85"
        style={{ letterSpacing: '0.1em', textShadow: '0 1px 8px rgba(20, 40, 80, 0.5)' }}
      >
        NPC Foundation &middot; Phase 4.1
      </p>
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
  return (
    <dl
      className="pointer-events-none absolute bottom-5 left-5 m-0 grid select-none grid-cols-[auto_1fr] gap-x-3 rounded-2xl border border-white/40 bg-white/55 px-4 py-3 text-xs text-[#1B3158] shadow-[0_8px_30px_rgba(27,49,88,0.18)] backdrop-blur-md sm:bottom-6 sm:left-7"
      style={{ lineHeight: 1.65 }}
    >
      <ControlRow keys="WASD" label={driving ? 'Drive / Steer' : 'Move'} />
      {!driving && <ControlRow keys="Shift" label="Sprint" />}
      <ControlRow keys="Space" label={driving ? 'Handbrake' : 'Jump'} />
      <ControlRow keys="E" label={driving ? 'Exit when stopped' : 'Talk / Enter nearby car'} />
      <ControlRow keys="Mouse Drag" label="Camera" />
      <ControlRow keys="Scroll" label="Zoom" />
      <ControlRow keys="F" label="Performance" note={showPerf ? 'on' : 'off'} />
      <ControlRow keys="P" label="Physics Debug" note={physicsDebug ? 'on' : 'off'} />
      <ControlRow keys="C" label="Debug Camera" note={cameraMode === 'orbit' ? 'on' : 'off'} />
      {import.meta.env.DEV && <ControlRow keys="Shift T" label="Time Controls" />}
    </dl>
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
      className="pointer-events-none absolute right-5 top-5 select-none rounded-xl bg-[#1B3158]/80 px-3 py-2 font-mono text-[11px] tabular-nums text-white top-[4.25rem] sm:right-7 sm:top-[4.5rem]"
    >
      measuring...
    </div>
  )
}

/** Small in-game entry point to reopen the character creator. */
const CharacterButton = memo(function CharacterButton() {
  const driving = useVehicleStore((s) => s.driving)
  const name = useCharacterStore((s) => s.settings.name)
  const open = useCharacterStore((s) => s.menuOpen)
  const openMenu = useCharacterStore((s) => s.openMenu)
  if (open) return null
  return (
    <button
      type="button"
      disabled={driving}
      title={driving ? 'Exit vehicle to edit character' : 'Edit character'}
      onClick={(e) => {
        // Release focus so a later Space press (jump) cannot re-activate this button.
        e.currentTarget.blur()
        openMenu()
      }}
      aria-label={`Edit character: ${name}`}
      className="pointer-events-auto absolute right-5 top-5 flex h-11 select-none items-center gap-2 rounded-full border border-white/50 bg-white/55 pl-3 pr-4 text-xs font-semibold text-[#1B3158] shadow-[0_8px_30px_rgba(27,49,88,0.18)] backdrop-blur-md transition-colors hover:bg-white/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B3158] sm:right-7 sm:top-6"
    >
      <UserRound size={16} aria-hidden="true" />
      <span className="max-w-[9rem] truncate">{name}</span>
    </button>
  )
})

function CreatorGate() {
  const open = useCharacterStore((s) => s.menuOpen)
  return open ? <CharacterCreator /> : null
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
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
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
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <Brand />
      <WorldTimeHud />
      <VehicleHud />
      <NPCDialogue />
      <PerfReadout />
      <Controls />
      <CharacterButton />
      <CreatorGate />
      <LoadingVeil />
    </div>
  )
}
