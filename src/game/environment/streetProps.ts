import { LINE_CLASS } from '../city/cityConfig'
import type { Block, DistrictId, Rect } from '../city/cityTypes'
import type { BuildingDef, Facing } from './envTypes'
import { footprint } from './localFrame'
import type { Placer } from './propLayout'

/**
 * Sidewalk furniture and keep-clear zones shared by every district.
 * Props sit about a metre in from the curb, so at least 1.1 m of every 2.5 m
 * sidewalk stays free for walking.
 */

export type SideName = 'N' | 'S' | 'W' | 'E'

/** Distance from a block corner within which nothing is placed (crosswalk landings and turning room). */
export const CORNER_CLEAR = 8

export function blockIndex(block: Block): { col: number; row: number } {
  return { col: Number(block.id[1]), row: Number(block.id[2]) }
}

/** True when the road along this side of the block is a main road. */
export function sideIsMain(block: Block, side: SideName): boolean {
  const { col, row } = blockIndex(block)
  const line = side === 'N' ? row : side === 'S' ? row + 1 : side === 'W' ? col : col + 1
  return LINE_CLASS[line] === 'main'
}

/** The four corner squares of a block, kept free for pedestrians crossing at junctions. */
export function cornerZones(r: Rect): Rect[] {
  const c = CORNER_CLEAR
  return [
    { minX: r.minX, maxX: r.minX + c, minZ: r.minZ, maxZ: r.minZ + c },
    { minX: r.maxX - c, maxX: r.maxX, minZ: r.minZ, maxZ: r.minZ + c },
    { minX: r.minX, maxX: r.minX + c, minZ: r.maxZ - c, maxZ: r.maxZ },
    { minX: r.maxX - c, maxX: r.maxX, minZ: r.maxZ - c, maxZ: r.maxZ },
  ]
}

/** A point `inset` metres in from a block side, `t` metres along it from the block's min corner. */
export function sidePoint(r: Rect, side: SideName, t: number, inset: number): { x: number; z: number } {
  switch (side) {
    case 'N':
      return { x: r.minX + t, z: r.minZ + inset }
    case 'S':
      return { x: r.minX + t, z: r.maxZ - inset }
    case 'W':
      return { x: r.minX + inset, z: r.minZ + t }
    default:
      return { x: r.maxX - inset, z: r.minZ + t }
  }
}

export function sideLength(r: Rect, side: SideName): number {
  return side === 'N' || side === 'S' ? r.maxX - r.minX : r.maxZ - r.minZ
}

/** Calls `fn` at every `spacing` metres along a side, between the corner zones. */
export function alongSide(r: Rect, side: SideName, spacing: number, phase: number, fn: (x: number, z: number) => void, inset = 1): void {
  const len = sideLength(r, side)
  for (let t = CORNER_CLEAR + 2 + phase; t <= len - CORNER_CLEAR - 2; t += spacing) {
    const p = sidePoint(r, side, t, inset)
    fn(p.x, p.z)
  }
}

export interface StreetConfig {
  lights: number
  /** Streetlights only along main roads. */
  lightsMainOnly: boolean
  trees: number
  treeKind: 'tree-round' | 'tree-conifer'
  benches: number
  bins: number
  hydrants: number
}

const SIDES: readonly SideName[] = ['N', 'S', 'W', 'E']

export function placeStreetFurniture(placer: Placer, block: Block, districtId: DistrictId, cfg: StreetConfig): void {
  const r = block.rect
  let n = 0
  for (const side of SIDES) {
    const facing: Facing = side
    const main = sideIsMain(block, side)
    if (cfg.lights > 0 && (main || !cfg.lightsMainOnly)) alongSide(r, side, cfg.lights, 0, (x, z) => placer.add('streetlight', districtId, x, z, facing), 0.8)
    if (cfg.trees > 0) alongSide(r, side, cfg.trees, cfg.lights > 0 ? cfg.lights / 2 : 0, (x, z) => placer.add(cfg.treeKind, districtId, x, z, facing, { variant: n++ }), 1)
    if (cfg.benches > 0) alongSide(r, side, cfg.benches, 5, (x, z) => placer.add('bench', districtId, x, z, facing, { variant: n++ }), 1)
    if (cfg.bins > 0) alongSide(r, side, cfg.bins, 11, (x, z) => placer.add('bin', districtId, x, z, facing), 0.9)
    if (cfg.hydrants > 0 && side === 'N') alongSide(r, side, cfg.hydrants, 21, (x, z) => placer.add('hydrant', districtId, x, z, facing), 0.9)
  }
}

/** Stop signs at the sidewalk corner nearest each secondary-road junction approach (visual landmarks for traffic later). */
export function placeStopSigns(placer: Placer, block: Block, districtId: DistrictId): void {
  const r = block.rect
  const c = CORNER_CLEAR + 1
  const spots: Array<{ x: number; z: number; facing: Facing }> = [
    { x: r.minX + 0.6, z: r.minZ + c, facing: 'W' },
    { x: r.maxX - 0.6, z: r.maxZ - c, facing: 'E' },
  ]
  for (const s of spots) placer.add('stop-sign', districtId, s.x, s.z, s.facing)
}

/**
 * Corridor from a building's entrance to the street it faces, as a world
 * rectangle. Everything solid stays out of it, so each doorway has a clear path.
 */
export function entranceCorridor(def: BuildingDef, block: Block): Rect {
  const fp = footprint(def.x, def.z, def.width, def.depth, def.facing)
  const vehicle = def.type === 'garage' || def.type === 'showroom' || def.type === 'warehouse' || def.type === 'workshop'
  const span = vehicle ? Math.min(def.width * 0.8, 20) : 6
  const half = span / 2
  const edge = block.rect
  switch (def.facing) {
    case 'S':
      return { minX: def.x - half, maxX: def.x + half, minZ: fp.maxZ, maxZ: edge.maxZ }
    case 'N':
      return { minX: def.x - half, maxX: def.x + half, minZ: edge.minZ, maxZ: fp.minZ }
    case 'E':
      return { minX: fp.maxX, maxX: edge.maxX, minZ: def.z - half, maxZ: def.z + half }
    default:
      return { minX: edge.minX, maxX: fp.minX, minZ: def.z - half, maxZ: def.z + half }
  }
}
