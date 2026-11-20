import type { GeometryBuilder } from '../city/geometryBuilder'
import type { Frame } from './localFrame'
import { PAL } from './envPalette'

/**
 * Reusable architectural pieces, written in a building's local frame (see
 * Frame): boxes, wall-mounted quads, window grids, doors, awnings, roofs.
 */

export type Side = 'front' | 'back' | 'left' | 'right'

export function lbox(b: GeometryBuilder, f: Frame, u0: number, u1: number, y0: number, y1: number, v0: number, v1: number, color: string): void {
  b.box(f.rect(u0, u1, v0, v1), y0, y1, color)
}

/** A flat quad on the outside of a wall. `a0..a1` runs along the wall (u for front/back, v for left/right). */
export function wallQuad(
  b: GeometryBuilder,
  f: Frame,
  side: Side,
  W: number,
  D: number,
  a0: number,
  a1: number,
  y0: number,
  y1: number,
  off: number,
  color: string,
): void {
  const horizontal = side === 'front' || side === 'back'
  const plane = horizontal ? (side === 'front' ? D / 2 + off : -D / 2 - off) : side === 'right' ? W / 2 + off : -W / 2 - off
  const at = (a: number, y: number): [number, number, number] => (horizontal ? f.pt(a, y, plane) : f.pt(plane, y, a))
  const n: [number, number, number] = horizontal ? [0, 0, side === 'front' ? 1 : -1] : [side === 'right' ? 1 : -1, 0, 0]
  b.quad(at(a0, y0), at(a1, y0), at(a1, y1), at(a0, y1), f.normal(n[0], n[1], n[2]), color)
}

export interface WindowGrid {
  /** Extent along the wall. */
  a0: number
  a1: number
  /** Height of the first floor's floor level, and of each floor. */
  yBase: number
  floorH: number
  floors: number
  cols: number
  winW: number
  winH: number
  /** Sill height above each floor level. */
  sill: number
  glass: string
  frame: string
  /** Return true to leave a cell empty (doors, signs, shopfronts). */
  skip?: (floor: number, col: number) => boolean
  /** Warm "lit" windows for a few cells, chosen deterministically. */
  litEvery?: number
}

export function windowGrid(b: GeometryBuilder, f: Frame, side: Side, W: number, D: number, g: WindowGrid): void {
  const cell = (g.a1 - g.a0) / g.cols
  for (let floor = 0; floor < g.floors; floor++) {
    for (let col = 0; col < g.cols; col++) {
      if (g.skip?.(floor, col)) continue
      const ac = g.a0 + cell * (col + 0.5)
      const y0 = g.yBase + floor * g.floorH + g.sill
      const lit = g.litEvery && (floor * 7 + col * 3) % g.litEvery === 0
      wallQuad(b, f, side, W, D, ac - g.winW / 2 - 0.12, ac + g.winW / 2 + 0.12, y0 - 0.12, y0 + g.winH + 0.12, 0.03, g.frame)
      wallQuad(b, f, side, W, D, ac - g.winW / 2, ac + g.winW / 2, y0, y0 + g.winH, 0.05, lit ? PAL.glassWarm : g.glass)
    }
  }
}

/** A framed door on the front wall, centred at `u`. */
export function door(b: GeometryBuilder, f: Frame, W: number, D: number, u: number, width: number, height: number, leaf: string, frame: string): void {
  wallQuad(b, f, 'front', W, D, u - width / 2 - 0.15, u + width / 2 + 0.15, 0, height + 0.15, 0.03, frame)
  wallQuad(b, f, 'front', W, D, u - width / 2, u + width / 2, 0, height, 0.05, leaf)
  wallQuad(b, f, 'front', W, D, u - 0.04, u + 0.04, 0.9, 1.1, 0.07, PAL.metal)
}

/** A sloped canopy over the front wall with a front valance and closed ends. */
export function awning(b: GeometryBuilder, f: Frame, u0: number, u1: number, y: number, vWall: number, depth: number, drop: number, color: string, valance = 0.35): void {
  const len = Math.hypot(depth, drop)
  b.quad(f.pt(u0, y, vWall), f.pt(u1, y, vWall), f.pt(u1, y - drop, vWall + depth), f.pt(u0, y - drop, vWall + depth), f.normal(0, depth / len, drop / len), color)
  b.quad(f.pt(u0, y - drop, vWall + depth), f.pt(u1, y - drop, vWall + depth), f.pt(u1, y - drop - valance, vWall + depth), f.pt(u0, y - drop - valance, vWall + depth), f.normal(0, 0, 1), PAL.frameWhite)
  for (const [u, sign] of [[u0, -1], [u1, 1]] as const) {
    b.tri(f.pt(u, y, vWall), f.pt(u, y - drop, vWall + depth), f.pt(u, y - drop, vWall), color, f.normal(sign, 0, 0))
  }
}

/** Walls of height `H` on a footprint of `W` x `D`, with a darker plinth where the building meets the ground. */
export function shell(b: GeometryBuilder, f: Frame, W: number, D: number, H: number, wall: string, plinth: string, plinthH = 0.45): void {
  lbox(b, f, -W / 2, W / 2, 0, H, -D / 2, D / 2, wall)
  lbox(b, f, -W / 2 - 0.08, W / 2 + 0.08, 0, plinthH, -D / 2 - 0.08, D / 2 + 0.08, plinth)
}

/** Flat roof slab with a parapet ring at height `H`. */
export function flatRoof(b: GeometryBuilder, f: Frame, W: number, D: number, H: number, parapet: number, roof: string, parapetColor: string, thick = 0.25): void {
  const t = thick
  lbox(b, f, -W / 2 + t, W / 2 - t, H, H + 0.12, -D / 2 + t, D / 2 - t, roof)
  lbox(b, f, -W / 2, W / 2, H, H + parapet, -D / 2, -D / 2 + t, parapetColor)
  lbox(b, f, -W / 2, W / 2, H, H + parapet, D / 2 - t, D / 2, parapetColor)
  lbox(b, f, -W / 2, -W / 2 + t, H, H + parapet, -D / 2 + t, D / 2 - t, parapetColor)
  lbox(b, f, W / 2 - t, W / 2, H, H + parapet, -D / 2 + t, D / 2 - t, parapetColor)
}

/** A small box on a roof: AC unit, stair housing, tank. */
export function rooftopUnit(b: GeometryBuilder, f: Frame, u: number, v: number, sx: number, sz: number, y0: number, h: number, color: string): void {
  lbox(b, f, u - sx / 2, u + sx / 2, y0, y0 + h, v - sz / 2, v + sz / 2, color)
}

export interface GableOptions {
  u0: number
  u1: number
  v0: number
  v1: number
  yEave: number
  rise: number
  overhang: number
  /** `u`: ridge parallel to the facade; `v`: gable end faces the street. */
  ridge: 'u' | 'v'
  roof: string
  gable: string
}

export function gableRoof(b: GeometryBuilder, f: Frame, g: GableOptions): void {
  const { u0, u1, v0, v1, yEave, rise, overhang: o } = g
  const um = (u0 + u1) / 2
  const vm = (v0 + v1) / 2
  if (g.ridge === 'u') {
    const run = v1 - vm
    const eaveY = yEave - (o * rise) / run
    const n = Math.hypot(run, rise)
    b.quad(f.pt(u0 - o, eaveY, v1 + o), f.pt(u1 + o, eaveY, v1 + o), f.pt(u1 + o, yEave + rise, vm), f.pt(u0 - o, yEave + rise, vm), f.normal(0, run / n, rise / n), g.roof)
    b.quad(f.pt(u1 + o, eaveY, v0 - o), f.pt(u0 - o, eaveY, v0 - o), f.pt(u0 - o, yEave + rise, vm), f.pt(u1 + o, yEave + rise, vm), f.normal(0, run / n, -rise / n), g.roof)
    for (const [u, s] of [[u0, -1], [u1, 1]] as const) b.tri(f.pt(u, yEave, v0), f.pt(u, yEave, v1), f.pt(u, yEave + rise, vm), g.gable, f.normal(s, 0, 0))
  } else {
    const run = u1 - um
    const eaveY = yEave - (o * rise) / run
    const n = Math.hypot(run, rise)
    b.quad(f.pt(u1 + o, eaveY, v1 + o), f.pt(u1 + o, eaveY, v0 - o), f.pt(um, yEave + rise, v0 - o), f.pt(um, yEave + rise, v1 + o), f.normal(rise / n, run / n, 0), g.roof)
    b.quad(f.pt(u0 - o, eaveY, v0 - o), f.pt(u0 - o, eaveY, v1 + o), f.pt(um, yEave + rise, v1 + o), f.pt(um, yEave + rise, v0 - o), f.normal(-rise / n, run / n, 0), g.roof)
    for (const [v, s] of [[v0, -1], [v1, 1]] as const) b.tri(f.pt(u0, yEave, v), f.pt(u1, yEave, v), f.pt(um, yEave + rise, v), g.gable, f.normal(0, 0, s))
  }
}
