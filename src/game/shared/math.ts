/** Frame-rate independent exponential smoothing of `current` toward `target`. */
export function damp(current: number, target: number, rate: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-rate * dt))
}

/** Same as `damp`, but along the shortest arc for angles in radians. */
export function dampAngle(current: number, target: number, rate: number, dt: number): number {
  const TWO_PI = Math.PI * 2
  const diff = ((((target - current + Math.PI) % TWO_PI) + TWO_PI) % TWO_PI) - Math.PI
  return current + diff * (1 - Math.exp(-rate * dt))
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}
