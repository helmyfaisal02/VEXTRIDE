import { Color, Vector3 } from 'three'
import { normalizeHour } from './worldTime'

export const smooth = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

export function nightAmount(hour: number): number {
  const h = normalizeHour(hour)
  return 1 - smooth(5, 7, h) * (1 - smooth(17, 19, h))
}

// Linear-space colour interpolation; repeated midnight key guarantees a seam-free wrap.
const keys = [
  [0, '#070e2d', '#14264c', '#283958', '#a5bce8'],
  [5, '#101d40', '#3c486b', '#a77c88', '#ffad73'],
  [6, '#516baf', '#ca9da7', '#ffd0a0', '#ffb469'],
  [7, '#568fd7', '#a5cceb', '#f7d9b0', '#fff1cf'],
  [10, '#3f86d6', '#8ec5f0', '#f7d9b0', '#fff1cf'],
  [16, '#3f86d6', '#8ec5f0', '#f7d9b0', '#fff1cf'],
  [17, '#527cbd', '#d5a3ac', '#ffc187', '#ffbd79'],
  [18, '#494b8a', '#b46e96', '#ef9868', '#ff9b57'],
  [19, '#101b42', '#30385f', '#78566f', '#b7c5ee'],
  [24, '#070e2d', '#14264c', '#283958', '#a5bce8'],
] as const
const palette = keys.map(([hour, top, mid, horizon, sun]) => ({ hour, top: new Color(top), mid: new Color(mid), horizon: new Color(horizon), sun: new Color(sun) }))

export function createLightingState() {
  return { top: new Color(), mid: new Color(), horizon: new Color(), sun: new Color(), sunDirection: new Vector3(), night: 0, sunIntensity: 0, ambientIntensity: 0, hemisphereIntensity: 0 }
}
export type LightingState = ReturnType<typeof createLightingState>

/** Mutates reusable colours/vectors: no geometry, materials, or React updates. */
export function updateLighting(hour: number, out: LightingState): LightingState {
  const h = normalizeHour(hour)
  const index = palette.findIndex((key, i) => i < palette.length - 1 && h >= key.hour && h < palette[i + 1].hour)
  const a = palette[Math.max(0, index)], b = palette[Math.max(0, index) + 1]
  const t = smooth(a.hour, b.hour, h)
  for (const key of ['top', 'mid', 'horizon', 'sun'] as const) out[key].copy(a[key]).lerp(b[key], t)
  const angle = (h - 6) * Math.PI / 12
  out.sunDirection.set(Math.cos(angle), Math.sin(angle) * 0.85, Math.sin(angle) * 0.35).normalize()
  out.night = nightAmount(h)
  out.sunIntensity = 2.4 * smooth(0, 0.35, out.sunDirection.y)
  out.ambientIntensity = 0.22 + 0.13 * (1 - out.night)
  out.hemisphereIntensity = 0.45 + 0.10 * (1 - out.night)
  return out
}

export const worldLighting = updateLighting(10, createLightingState())
