import { useEffect, useState, useSyncExternalStore } from 'react'
import { resetInput } from '../input/inputState'
import { isGameplayModalOpen } from '../input/gameplayUi'
import { isTypingTarget } from '../shared/dom'
import { useCharacterStore } from '../state/characterStore'
import { formatWorldTime, timePeriod, worldClock } from '../world/worldTime'

/** The clock publishes minute changes; the scene never re-renders for time updates. */
export function WorldTimeHud() {
  useSyncExternalStore(worldClock.subscribe, worldClock.getSnapshot, worldClock.getSnapshot)
  const [open, setOpen] = useState(false)
  const creatorOpen = useCharacterStore((s) => s.menuOpen)
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const toggle = (event: KeyboardEvent) => {
      if (isGameplayModalOpen() || event.defaultPrevented || event.repeat || event.ctrlKey || event.altKey || event.metaKey || isTypingTarget(event.target)) return
      if (event.shiftKey && event.code === 'KeyT') {
        event.preventDefault()
        resetInput()
        setOpen((value) => !value)
      }
    }
    window.addEventListener('keydown', toggle)
    return () => window.removeEventListener('keydown', toggle)
  }, [])

  return (
    <>
      <div className="rounded-xl bg-[#142440]/90 px-3 py-2 text-xs tabular-nums text-white" data-testid="world-time">
        <time>{formatWorldTime(worldClock.hour)}</time>
        <span className="ml-2 text-white/75">{timePeriod(worldClock.hour)}{worldClock.paused ? ' · Paused' : ''}</span>
      </div>
      {import.meta.env.DEV && !creatorOpen && open && (
        <section
          aria-label="Developer world time"
          className="vex-time-controls pointer-events-auto z-10 w-full max-w-64 space-y-3 rounded-xl bg-[#142440]/95 p-4 text-xs text-white"
          onFocusCapture={() => resetInput()}
          onKeyDown={(event) => { if (event.code === 'Escape') setOpen(false); event.stopPropagation() }}
        >
          <div className="flex justify-between"><strong>Developer world time</strong><button type="button" aria-label="Close time controls" onClick={() => setOpen(false)}>×</button></div>
          <label className="flex flex-wrap items-center justify-between gap-2">World hour
            <select aria-label="World hour" value={Math.floor(worldClock.hour)} className="rounded bg-[#304563] p-1" onChange={(event) => { worldClock.setPaused(true); worldClock.setHour(Number(event.target.value)) }}>
              {Array.from({ length: 24 }, (_, hour) => <option key={hour} value={hour}>{formatWorldTime(hour)}</option>)}
            </select>
          </label>
          <div className="flex gap-3">
            <button type="button" className="rounded bg-[#304563] px-2 py-1" onClick={() => worldClock.setPaused(!worldClock.paused)}>{worldClock.paused ? 'Resume' : 'Pause'}</button>
            <button type="button" className="rounded bg-[#304563] px-2 py-1" onClick={() => { worldClock.setPaused(false); resetInput() }}>Automatic</button>
          </div>
          <p className="text-white/70">Selecting an hour pauses time. Automatic resumes the 30-minute cycle from that time.</p>
        </section>
      )}
    </>
  )
}
