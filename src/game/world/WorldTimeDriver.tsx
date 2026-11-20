import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { updateLighting, worldLighting } from './dayNight'
import { parseTimeSetting, WORLD_TIME_KEY, worldClock } from './worldTime'

/** Single clock driver, before all lighting consumers. No wall-clock catch-up. */
export function WorldTimeDriver() {
  const skipFrame = useRef(true)
  useEffect(() => {
    try {
      const setting = parseTimeSetting(localStorage.getItem(WORLD_TIME_KEY))
      if (setting) worldClock.restore(setting)
    } catch { /* Storage may be blocked; keep an in-memory clock. */ }
    const save = () => {
      try { localStorage.setItem(WORLD_TIME_KEY, JSON.stringify(worldClock.setting())) } catch { /* Optional persistence. */ }
    }
    const visibility = () => { skipFrame.current = true; save() }
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('pagehide', save)
    const interval = window.setInterval(save, 15_000)
    return () => {
      save()
      clearInterval(interval)
      document.removeEventListener('visibilitychange', visibility)
      window.removeEventListener('pagehide', save)
    }
  }, [])
  useFrame((_, delta) => {
    worldClock.advance(skipFrame.current ? 0 : delta, document.hidden)
    skipFrame.current = false
    updateLighting(worldClock.hour, worldLighting)
  }, -100)
  return null
}
