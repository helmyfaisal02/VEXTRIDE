import { ROAD_TOP, SIDEWALK_TOP } from '../city/cityConfig'
import type { DistrictId, Rect } from '../city/cityTypes'
import { surfaceHeightAt } from '../city/citySurface'
import type { Facing, PaintRect, PropDef, PropKind } from './envTypes'

/**
 * Deterministic prop placement. Props are placed in a fixed order; each is
 * accepted only if its footprint clears everything already placed, every
 * keep-clear zone (spawn, doorsteps, junction corners) and the building
 * footprints. Rejected props are simply skipped, so a layout can never end up
 * with overlapping or blocking objects.
 */

interface KindSpec {
  /** Footprint (x, z) when facing N or S. */
  sx: number
  sz: number
  height: number
  collide: boolean
  /** Extra clearance kept around the prop when placing. */
  margin: number
}

export const KIND_SPECS: Record<PropKind, KindSpec> = {
  streetlight: { sx: 0.35, sz: 0.35, height: 7, collide: true, margin: 1.2 },
  'tree-round': { sx: 0.6, sz: 0.6, height: 7, collide: true, margin: 1.6 },
  'tree-conifer': { sx: 0.6, sz: 0.6, height: 9, collide: true, margin: 1.4 },
  bench: { sx: 1.9, sz: 0.65, height: 0.9, collide: true, margin: 0.8 },
  bin: { sx: 0.55, sz: 0.55, height: 0.95, collide: true, margin: 0.8 },
  planter: { sx: 2.4, sz: 0.95, height: 0.6, collide: true, margin: 0.8 },
  'stop-sign': { sx: 0.25, sz: 0.25, height: 2.6, collide: true, margin: 0.6 },
  fence: { sx: 0.14, sz: 3, height: 1.2, collide: true, margin: 0 },
  container: { sx: 2.45, sz: 6.1, height: 2.6, collide: true, margin: 0.4 },
  monument: { sx: 9, sz: 9, height: 15, collide: true, margin: 2 },
  hydrant: { sx: 0.45, sz: 0.45, height: 0.85, collide: true, margin: 0.6 },
  'utility-box': { sx: 0.95, sz: 0.65, height: 1.25, collide: true, margin: 0.8 },
  shelter: { sx: 7, sz: 5, height: 3.4, collide: true, margin: 1.5 },
  bollard: { sx: 0.3, sz: 0.3, height: 0.95, collide: true, margin: 0.4 },
  'tire-stack': { sx: 1.0, sz: 1.0, height: 1.3, collide: true, margin: 0.5 },
}

const rotates = (f: Facing) => f === 'E' || f === 'W'

export function inflate(r: Rect, m: number): Rect {
  return { minX: r.minX - m, maxX: r.maxX + m, minZ: r.minZ - m, maxZ: r.maxZ + m }
}

export function overlaps(a: Rect, b: Rect, eps = 1e-9): boolean {
  return a.minX < b.maxX - eps && a.maxX > b.minX + eps && a.minZ < b.maxZ - eps && a.maxZ > b.minZ + eps
}

export function propRect(x: number, z: number, kind: PropKind, facing: Facing, length?: number): Rect {
  const spec = KIND_SPECS[kind]
  let sx = spec.sx
  let sz = spec.sz
  if (kind === 'fence' && length !== undefined) sz = length
  if (rotates(facing)) [sx, sz] = [sz, sx]
  return { minX: x - sx / 2, maxX: x + sx / 2, minZ: z - sz / 2, maxZ: z + sz / 2 }
}

/** Subtracts `hole` from `base`, returning up to four rectangles that tile the rest. */
export function subtractRect(base: Rect, hole: Rect): Rect[] {
  if (!overlaps(base, hole)) return [base]
  const h = {
    minX: Math.max(base.minX, hole.minX),
    maxX: Math.min(base.maxX, hole.maxX),
    minZ: Math.max(base.minZ, hole.minZ),
    maxZ: Math.min(base.maxZ, hole.maxZ),
  }
  const out: Rect[] = []
  if (h.minZ > base.minZ) out.push({ minX: base.minX, maxX: base.maxX, minZ: base.minZ, maxZ: h.minZ })
  if (h.maxZ < base.maxZ) out.push({ minX: base.minX, maxX: base.maxX, minZ: h.maxZ, maxZ: base.maxZ })
  if (h.minX > base.minX) out.push({ minX: base.minX, maxX: h.minX, minZ: h.minZ, maxZ: h.maxZ })
  if (h.maxX < base.maxX) out.push({ minX: h.maxX, maxX: base.maxX, minZ: h.minZ, maxZ: h.maxZ })
  return out
}

/** Small deterministic PRNG so variants are stable across runs. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export class Placer {
  readonly props: PropDef[] = []
  readonly paint: PaintRect[] = []
  private readonly occupied: Rect[] = []
  private readonly keepClear: Rect[]
  private count = 0

  constructor(solids: readonly Rect[], keepClear: readonly Rect[]) {
    this.occupied.push(...solids)
    this.keepClear = [...keepClear]
  }

  /** True when `rect`, with `margin` around it, hits nothing already placed and no keep-clear zone. */
  fits(rect: Rect, margin: number): boolean {
    const r = inflate(rect, margin)
    return !this.occupied.some((o) => overlaps(r, o)) && !this.keepClear.some((k) => overlaps(rect, k))
  }

  /** Reserves space (a building, a paved area) without adding a prop. */
  reserve(rect: Rect): void {
    this.occupied.push(rect)
  }

  add(kind: PropKind, districtId: DistrictId, x: number, z: number, facing: Facing, o: { variant?: number; length?: number; height?: number; margin?: number } = {}): PropDef | null {
    const spec = KIND_SPECS[kind]
    const rect = propRect(x, z, kind, facing, o.length)
    if (!this.fits(rect, o.margin ?? spec.margin)) return null
    this.occupied.push(rect)
    const height = o.height ?? spec.height
    const prop: PropDef = {
      id: `${kind}-${String(++this.count).padStart(3, '0')}`,
      kind,
      districtId,
      x,
      z,
      facing,
      sx: rect.maxX - rect.minX,
      sz: rect.maxZ - rect.minZ,
      height,
      variant: o.variant ?? 0,
      collide: spec.collide,
    }
    this.props.push(prop)
    return prop
  }

  paintRect(rect: Rect, color: string, layer: 'base' | 'lines', y: number = ROAD_TOP): void {
    if (rect.maxX - rect.minX > 1e-6 && rect.maxZ - rect.minZ > 1e-6) this.paint.push({ rect, color, layer, y })
  }

  /** Paints the union of `rects` without any two painted pieces overlapping. */
  paintUnion(rects: readonly Rect[], color: string, y: number = ROAD_TOP): void {
    const done: Rect[] = []
    for (const r of rects) {
      let pieces = [r]
      for (const d of done) pieces = pieces.flatMap((p) => subtractRect(p, d))
      for (const p of pieces) this.paintRect(p, color, 'base', y)
      done.push(r)
    }
  }

  /** Paints `rect` minus every rect in `holes`, as non-overlapping pieces. */
  paintAround(rect: Rect, holes: readonly Rect[], color: string, y: number = ROAD_TOP): void {
    let pieces = [rect]
    for (const h of holes) pieces = pieces.flatMap((p) => subtractRect(p, h))
    for (const p of pieces) this.paintRect(p, color, 'base', y)
  }
}

/** Overlap of two rectangles, or null when they do not overlap. */
export function intersect(a: Rect, b: Rect): Rect | null {
  const r = { minX: Math.max(a.minX, b.minX), maxX: Math.min(a.maxX, b.maxX), minZ: Math.max(a.minZ, b.minZ), maxZ: Math.min(a.maxZ, b.maxZ) }
  return r.maxX > r.minX && r.maxZ > r.minZ ? r : null
}

/** Rectangle of the given size centred on a point. */
export function around(x: number, z: number, sx: number, sz: number): Rect {
  return { minX: x - sx / 2, maxX: x + sx / 2, minZ: z - sz / 2, maxZ: z + sz / 2 }
}

export function baseYAt(x: number, z: number): number {
  return surfaceHeightAt(x, z) || ROAD_TOP
}

export { SIDEWALK_TOP }
