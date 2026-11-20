/** Public simulation clock for lighting and future gameplay. Hours are [0, 24). */
export const DAY_SECONDS = 30 * 60
export const INITIAL_HOUR = 10
export const WORLD_TIME_KEY = 'vextride.world-time.v1'

export function normalizeHour(hour: number): number {
  return Number.isFinite(hour) ? ((hour % 24) + 24) % 24 : INITIAL_HOUR
}

export function advanceHour(hour: number, delta: number, paused = false): number {
  // Discard suspension/stall deltas rather than catching up an inactive tab.
  if (paused || !Number.isFinite(delta) || delta < 0 || delta > 1) return normalizeHour(hour)
  return normalizeHour(hour + delta * 24 / DAY_SECONDS)
}

export function timePeriod(hour: number): 'Sunrise' | 'Daytime' | 'Sunset' | 'Nighttime' {
  const h = normalizeHour(hour)
  return h < 5 || h >= 19 ? 'Nighttime' : h < 7 ? 'Sunrise' : h < 17 ? 'Daytime' : 'Sunset'
}

export function formatWorldTime(hour: number): string {
  const minute = Math.floor(normalizeHour(hour) * 60 + 1e-8) % 1440
  const h = Math.floor(minute / 60)
  return `${h % 12 || 12}:${String(minute % 60).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

export interface TimeSetting { version: 1; hour: number; paused: boolean }

export function parseTimeSetting(raw: string | null): TimeSetting | null {
  try {
    const value: unknown = JSON.parse(raw ?? 'null')
    if (!value || typeof value !== 'object') return null
    const s = value as Partial<TimeSetting>
    return s.version === 1 && typeof s.hour === 'number' && Number.isFinite(s.hour) && s.hour >= 0 && s.hour < 24 && typeof s.paused === 'boolean'
      ? { version: 1, hour: s.hour, paused: s.paused } : null
  } catch { return null }
}

export class WorldClock {
  hour = INITIAL_HOUR
  paused = false
  private listeners = new Set<() => void>()
  /** Snapshot changes once per game minute, or immediately on developer edits. */
  getSnapshot = (): string => `${Math.floor(this.hour * 60)}:${this.paused}`
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }
  private emit() { this.listeners.forEach((listener) => listener()) }
  advance(delta: number, hidden = false): void {
    const previous = this.getSnapshot()
    if (!hidden) this.hour = advanceHour(this.hour, delta, this.paused)
    if (previous !== this.getSnapshot()) this.emit()
  }
  setHour(hour: number): void {
    if (!Number.isFinite(hour)) return
    this.hour = normalizeHour(hour)
    this.emit()
  }
  setPaused(paused: boolean): void { this.paused = paused; this.emit() }
  restore(setting: TimeSetting): void {
    this.hour = setting.hour
    this.paused = setting.paused
    this.emit()
  }
  setting(): TimeSetting { return { version: 1, hour: this.hour, paused: this.paused } }
}

// Per-frame values stay outside React/Zustand, like playerState and cameraRig.
export const worldClock = new WorldClock()
