import type { Block, Rect } from '../city/cityTypes'
import { PAL } from './envPalette'
import type { BuildingDef } from './envTypes'
import { Frame, footprint } from './localFrame'
import { around, intersect, seededRandom, type Placer } from './propLayout'
import { entranceCorridor, placeStopSigns, placeStreetFurniture } from './streetProps'

/** Downtown, Residential and Motor Row content. Each function places props and paint through the shared Placer. */

export type DistrictContext = { placer: Placer; block: (id: string) => Block; buildings: readonly BuildingDef[]; riverReserve: Rect }

const lotOf = (c: DistrictContext, id: string): Rect => c.block(id).lot as Rect

/** Pocket trees on a grid inside a lot, kept clear of buildings. */
function scatterTrees(c: DistrictContext, lot: Rect, district: BuildingDef['districtId'], step: number, seed: number, kind: 'tree-round' | 'tree-conifer', max: number, edge = 3): void {
  const rnd = seededRandom(seed)
  let count = 0
  for (let x = lot.minX + edge; x <= lot.maxX - edge && count < max; x += step) {
    for (let z = lot.minZ + edge; z <= lot.maxZ - edge && count < max; z += step) {
      const jx = (rnd() - 0.5) * step * 0.5
      const jz = (rnd() - 0.5) * step * 0.5
      if (c.placer.add(kind, district, x + jx, z + jz, 'S', { variant: Math.floor(rnd() * 8) })) count++
    }
  }
}

/** Paves the forecourt of a building: the corridor to its street, clipped to the lot. */
function paveForecourt(c: DistrictContext, def: BuildingDef, color: string): void {
  const block = c.block(def.blockId)
  const strip = intersect(entranceCorridor(def, block), block.lot as Rect)
  if (strip) c.placer.paintRect(strip, color, 'base')
}

/** A point `u` along and `v` out from a building's front wall. */
function front(def: BuildingDef, u: number, v: number): { x: number; z: number } {
  const [x, , z] = new Frame(def.x, def.z, def.facing).pt(u, 0, def.depth / 2 + v)
  return { x, z }
}

export function placeDowntown(c: DistrictContext): void {
  for (const id of ['B10', 'B20']) {
    const block = c.block(id)
    placeStreetFurniture(c.placer, block, 'downtown', { lights: 52, lightsMainOnly: true, trees: 20, treeKind: 'tree-round', benches: 50, bins: 60, hydrants: 52 })
    placeStopSigns(c.placer, block, 'downtown')
  }
  for (const def of c.buildings.filter((b) => b.districtId === 'downtown')) {
    paveForecourt(c, def, PAL.promenade)
    const office = def.type === 'office'
    const side = office ? 7 : def.width / 2 - 3
    const reach = office ? 4.5 : 3
    for (const s of [-1, 1]) {
      const p = front(def, s * side, reach)
      c.placer.add('planter', 'downtown', p.x, p.z, def.facing, { variant: s + 2 })
      const t = front(def, s * (side + 5), reach + 1)
      if (office) c.placer.add('tree-round', 'downtown', t.x, t.z, def.facing, { variant: s + 5 })
      else {
        const bn = front(def, s * (side - 2), 2)
        c.placer.add('bench', 'downtown', bn.x, bn.z, def.facing)
      }
    }
  }
  scatterTrees(c, lotOf(c, 'B10'), 'downtown', 11, 101, 'tree-round', 4)
  scatterTrees(c, lotOf(c, 'B20'), 'downtown', 11, 202, 'tree-round', 4)
}

/** Driveway centre (z) beside each house, in the gap between neighbours, keyed by building id. */
const DRIVEWAY_Z: Record<string, number> = { 'building-07': -113, 'building-08': -132.75, 'building-10': -69.5, 'building-11': -34.5 }

export function placeResidential(c: DistrictContext): void {
  for (const id of ['B00', 'B01']) {
    const block = c.block(id)
    placeStreetFurniture(c.placer, block, 'residential', { lights: 56, lightsMainOnly: true, trees: 18, treeKind: 'tree-round', benches: 0, bins: 70, hydrants: 46 })
    placeStopSigns(c.placer, block, 'residential')
  }
  for (const def of c.buildings.filter((b) => b.districtId === 'residential')) {
    const block = c.block(def.blockId)
    const lot = block.lot as Rect
    if (def.type === 'apartment') {
      paveForecourt(c, def, PAL.promenade)
      for (const s of [-1, 1]) {
        const p = front(def, s * 6, 3)
        c.placer.add('planter', 'residential', p.x, p.z, def.facing, { variant: s + 3 })
        const t = front(def, s * 11, 3.5)
        c.placer.add('tree-round', 'residential', t.x, t.z, def.facing, { variant: s + 6 })
      }
      continue
    }
    // House: walkway from the porch to the street, a fenced front yard with a gate, a driveway, yard trees.
    const fp = footprint(def.x, def.z, def.width, def.depth, def.facing)
    // Every house faces east (toward the secondary road): the walkway runs from the porch to the lot edge.
    c.placer.paintRect({ minX: fp.maxX + 2.4, maxX: lot.maxX, minZ: def.z - 0.7, maxZ: def.z + 0.7 }, PAL.driveway, 'base')
    const dz = DRIVEWAY_Z[def.id]
    const driveway: Rect | null = dz === undefined ? null : { minX: lot.maxX - 21, maxX: lot.maxX, minZ: dz - 1.5, maxZ: dz + 1.5 }
    if (driveway) c.placer.paintRect(driveway, PAL.driveway, 'base')
    const fenceX = lot.maxX - 1.5
    const gaps: Array<[number, number]> = [[def.z - 1.4, def.z + 1.4]]
    if (dz !== undefined) gaps.push([dz - 1.9, dz + 1.9])
    fenceRun(c, fenceX, def.z - def.width / 2 - 2, def.z + def.width / 2 + 2, gaps)
    const back = around(fp.minX - 5, def.z, 4, 4)
    c.placer.add('tree-round', 'residential', back.minX + 2, def.z + (def.variant % 2 ? 4 : -4), 'S', { variant: def.variant })
  }
  scatterTrees(c, lotOf(c, 'B00'), 'residential', 12, 303, 'tree-round', 5)
  scatterTrees(c, lotOf(c, 'B01'), 'residential', 12, 404, 'tree-conifer', 5)
}

/** A picket fence along x = `x` from z0 to z1, broken by gates. Each piece is up to 3 m long. */
function fenceRun(c: DistrictContext, x: number, z0: number, z1: number, gaps: ReadonlyArray<readonly [number, number]>): void {
  let z = z0
  while (z < z1 - 0.3) {
    const gap = gaps.find(([a, b]) => z >= a - 1e-6 && z < b)
    if (gap) {
      z = gap[1]
      continue
    }
    const nextGap = gaps.filter(([a]) => a > z).sort((p, q) => p[0] - q[0])[0]
    const end = Math.min(z + 3, z1, nextGap ? nextGap[0] : Infinity)
    if (end - z > 0.4) c.placer.add('fence', 'residential', x, (z + end) / 2, 'N', { length: end - z, variant: 0 })
    z = end
  }
}

export function placeMotorRow(c: DistrictContext): void {
  for (const id of ['B30', 'B31']) {
    const block = c.block(id)
    placeStreetFurniture(c.placer, block, 'motor-row', { lights: 48, lightsMainOnly: true, trees: 0, treeKind: 'tree-round', benches: 0, bins: 60, hydrants: 0 })
    placeStopSigns(c.placer, block, 'motor-row')
  }
  const lines = (rect: Rect, rows: Array<[number, number]>, stall: number, pad: Rect): void => {
    c.placer.paintRect(pad, PAL.asphaltPad, 'base')
    for (const [z0, z1] of rows) {
      for (let x = rect.minX; x <= rect.maxX + 1e-6; x += stall) c.placer.paintRect({ minX: x - 0.06, maxX: x + 0.06, minZ: z0, maxZ: z1 }, PAL.paintWhite, 'lines')
    }
  }
  // Customer parking behind the garage and showroom (north of both).
  const lotN = lotOf(c, 'B30')
  const padN: Rect = { minX: lotN.minX + 3, maxX: lotN.maxX - 2, minZ: lotN.minZ + 3, maxZ: lotN.minZ + 31 }
  lines({ ...padN, minX: padN.minX + 1, maxX: padN.maxX - 1 }, [[padN.minZ + 1, padN.minZ + 6], [padN.maxZ - 6, padN.maxZ - 1]], 2.8, padN)
  for (let i = 0; i < 3; i++) c.placer.add('streetlight', 'motor-row', padN.minX + 12 + i * 18, (padN.minZ + padN.maxZ) / 2, 'S')
  // Parking beside the workshop and the store.
  const lotS = lotOf(c, 'B31')
  const padS: Rect = { minX: lotS.minX + 31, maxX: lotS.maxX - 3, minZ: lotS.maxZ - 24, maxZ: lotS.maxZ - 2 }
  lines({ ...padS, minX: padS.minX + 1, maxX: padS.maxX - 1 }, [[padS.minZ + 1, padS.minZ + 6], [padS.maxZ - 6, padS.maxZ - 1]], 2.8, padS)
  c.placer.add('streetlight', 'motor-row', (padS.minX + padS.maxX) / 2, (padS.minZ + padS.maxZ) / 2, 'S')
  for (const def of c.buildings.filter((b) => b.districtId === 'motor-row')) {
    paveForecourt(c, def, PAL.driveway)
    if (def.type === 'garage' || def.type === 'workshop') {
      const side = front(def, -def.width / 2 - 1.1, -def.depth / 2 + 2.5)
      c.placer.add('tire-stack', 'motor-row', side.x, side.z, def.facing)
      const side2 = front(def, -def.width / 2 - 1.1, -def.depth / 2 + 5)
      c.placer.add('tire-stack', 'motor-row', side2.x, side2.z, def.facing, { variant: 1 })
      const box = front(def, def.width / 2 + 1.5, -def.depth / 2 + 3)
      c.placer.add('utility-box', 'motor-row', box.x, box.z, def.facing)
    }
    if (def.type === 'convenience-store') {
      const bn = front(def, def.width / 2 - 1.5, 3.2)
      c.placer.add('bench', 'motor-row', bn.x, bn.z, def.facing)
      const bin = front(def, -def.width / 2 + 1.5, 3.2)
      c.placer.add('bin', 'motor-row', bin.x, bin.z, def.facing)
    }
  }
}
