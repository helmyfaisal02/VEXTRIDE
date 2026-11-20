import { SIDEWALK_TOP } from '../city/cityConfig'
import type { Rect } from '../city/cityTypes'
import type { DistrictContext } from './districtsA'
import { PAL } from './envPalette'
import type { Facing } from './envTypes'
import { Frame } from './localFrame'
import { around, intersect, seededRandom } from './propLayout'
import { entranceCorridor, placeStopSigns, placeStreetFurniture } from './streetProps'

/** Industrial, Riverside and Central Plaza content. */

const lotOf = (c: DistrictContext, id: string): Rect => c.block(id).lot as Rect

/** Containers in rows. `along` is the facing of their long axis (N = along Z, E = along X). */
function containerRows(c: DistrictContext, cols: number[], rows: number[], along: Facing, seed: number): void {
  const rnd = seededRandom(seed)
  let n = 0
  for (const x of cols) {
    for (const z of rows) {
      c.placer.add('container', 'industrial', x, z, along, { variant: n++, height: rnd() > 0.55 ? 5.2 : 2.6, margin: 0.2 })
    }
  }
}

export function placeIndustrial(c: DistrictContext): void {
  for (const id of ['B32', 'B23', 'B33']) {
    const block = c.block(id)
    placeStreetFurniture(c.placer, block, 'industrial', { lights: 60, lightsMainOnly: true, trees: 34, treeKind: 'tree-conifer', benches: 0, bins: 0, hydrants: 42 })
    placeStopSigns(c.placer, block, 'industrial')
  }
  for (const def of c.buildings.filter((b) => b.districtId === 'industrial')) {
    const block = c.block(def.blockId)
    const strip = intersect(entranceCorridor(def, block), block.lot as Rect)
    if (strip) c.placer.paintRect(strip, PAL.driveway, 'base')
    if (def.type === 'warehouse') {
      // Loading zone beside the dock: paved apron with a yellow safety line.
      const f = new Frame(def.x, def.z, def.facing)
      const apron = f.rect(def.width / 2 + 3.3, def.width / 2 + 9, -def.depth / 2 + 4, def.depth / 2 - 4)
      c.placer.paintRect(apron, PAL.driveway, 'base')
      c.placer.paintRect(f.rect(def.width / 2 + 3.4, def.width / 2 + 3.55, -def.depth / 2 + 4, def.depth / 2 - 4), PAL.paintYellow, 'lines')
      c.placer.reserve(apron)
    }
  }
  // Container yards and a yard fence with a gate.
  containerRows(c, [130, 134.5], [20, 28, 36, 44, 52], 'N', 11)
  for (let z = 14; z < 70; z += 3) if (z < 38 || z >= 44) c.placer.add('fence', 'industrial', 126, z + 1.5, 'N', { length: 3, variant: 1 })
  containerRows(c, [101, 109, 117, 125, 133], [140, 144.5], 'E', 22)
  containerRows(c, [66], [100, 108, 116], 'N', 33)
  c.placer.add('utility-box', 'industrial', 88.5, 70, 'E')
  c.placer.add('utility-box', 'industrial', 12, 90, 'S')
}

export function placeRiverside(c: DistrictContext): void {
  const park = lotOf(c, 'B02')
  const south = lotOf(c, 'B03')
  const east = lotOf(c, 'B13')
  for (const id of ['B02', 'B03', 'B13']) {
    const block = c.block(id)
    placeStreetFurniture(c.placer, block, 'riverside', { lights: 52, lightsMainOnly: true, trees: 18, treeKind: 'tree-round', benches: 44, bins: 60, hydrants: 0 })
    placeStopSigns(c.placer, block, 'riverside')
  }
  // Pedestrian promenade along the future riverbank and park paths.
  const prom = (lot: Rect): Rect => ({ minX: lot.minX, maxX: lot.maxX, minZ: 124, maxZ: 129 })
  const plazaSq = around(-118, 41, 14, 14)
  const vertical: Rect = { minX: -120, maxX: -116, minZ: park.minZ, maxZ: park.maxZ }
  const horizontal: Rect = { minX: park.minX, maxX: park.maxX, minZ: 39, maxZ: 43 }
  const cafeBuilding = c.buildings.find((b) => b.districtId === 'riverside')
  const cafeStrip = cafeBuilding ? intersect(entranceCorridor(cafeBuilding, c.block('B13')), east) : null
  const parkPaths = [plazaSq, vertical, horizontal]
  const southPaths = [prom(south)]
  // The cafe stands on a paved terrace that joins the promenade.
  const terrace = cafeBuilding ? around(cafeBuilding.x, cafeBuilding.z, cafeBuilding.width + 4, cafeBuilding.depth + 4) : null
  const eastPaths = [prom(east), ...(cafeStrip ? [cafeStrip] : []), ...(terrace ? [terrace] : [])]
  c.placer.paintUnion(parkPaths, PAL.promenade)
  c.placer.paintUnion(southPaths, PAL.promenade)
  c.placer.paintUnion(eastPaths, PAL.promenade)
  const reserve = c.riverReserve
  const lawn = (lot: Rect, paths: Rect[], extra: Rect[] = []) => c.placer.paintAround(lot, [...paths, ...extra, ...(intersect(lot, reserve) ? [reserve] : [])], PAL.lawn)
  // Lawns go on a slightly higher layer than the lot tint: they replace it everywhere except paths and the river strip.
  lawn(park, parkPaths)
  lawn(south, southPaths)
  lawn(east, eastPaths)
  // Pavilion in the park square, with benches around it.
  c.placer.add('shelter', 'riverside', -118, 41, 'S')
  for (const [dx, dz, f] of [[0, -6, 'S'], [0, 6, 'N'], [-6.5, 0, 'E'], [6.5, 0, 'W']] as const) c.placer.add('bench', 'riverside', -118 + dx, 41 + dz, f)
  // Promenade benches facing the water, lamps and a stone rail along the bank.
  for (const lot of [south, east]) {
    for (let x = lot.minX + 8; x < lot.maxX - 8; x += 12) c.placer.add('bench', 'riverside', x, 130.2, 'S', { variant: Math.round(x) })
    for (let x = lot.minX + 14; x < lot.maxX - 10; x += 22) c.placer.add('streetlight', 'riverside', x, 123, 'S')
    for (let x = lot.minX + 2; x < lot.maxX - 2; x += 3) {
      if (Math.abs(((x - lot.minX) % 24) - 12) < 3) continue
      c.placer.add('fence', 'riverside', x + 1.5, 133.2, 'E', { length: 3, variant: 2, margin: 0 })
    }
  }
  scatterRiversideTrees(c, [park, south, east])
  c.placer.add('bin', 'riverside', -113, 36, 'S')
  c.placer.add('bin', 'riverside', -123, 46, 'N')
}

function scatterRiversideTrees(c: DistrictContext, lots: Rect[]): void {
  const rnd = seededRandom(505)
  for (const lot of lots) {
    let count = 0
    for (let x = lot.minX + 4; x <= lot.maxX - 4 && count < 10; x += 9) {
      for (let z = lot.minZ + 4; z <= lot.maxZ - 4 && count < 10; z += 9) {
        const kind = rnd() > 0.7 ? 'tree-conifer' : 'tree-round'
        if (c.placer.add(kind, 'riverside', x + (rnd() - 0.5) * 4, z + (rnd() - 0.5) * 4, 'S', { variant: Math.floor(rnd() * 8), margin: 2.2 })) count++
      }
    }
  }
}

export function placePlaza(c: DistrictContext): void {
  const y = SIDEWALK_TOP
  const stone = '#bcb4a2'
  const medal = '#cfc7b4'
  const frame = (r: Rect, w: number): Rect[] => [
    { minX: r.minX, maxX: r.maxX, minZ: r.minZ, maxZ: r.minZ + w },
    { minX: r.minX, maxX: r.maxX, minZ: r.maxZ - w, maxZ: r.maxZ },
    { minX: r.minX, maxX: r.minX + w, minZ: r.minZ + w, maxZ: r.maxZ - w },
    { minX: r.maxX - w, maxX: r.maxX, minZ: r.minZ + w, maxZ: r.maxZ - w },
  ]
  for (const id of ['B11', 'B21', 'B12', 'B22']) {
    const block = c.block(id)
    const r = block.rect
    const cx = (r.minX + r.maxX) / 2
    const cz = (r.minZ + r.maxZ) / 2
    for (const piece of frame({ minX: r.minX + 4, maxX: r.maxX - 4, minZ: r.minZ + 4, maxZ: r.maxZ - 4 }, 1.2)) c.placer.paintRect(piece, stone, 'base', y)
    const half = 14
    for (const piece of frame(around(cx, cz, half * 2, half * 2), 1.2)) c.placer.paintRect(piece, stone, 'base', y)
    c.placer.paintRect(around(cx, cz, half * 2 - 2.4, half * 2 - 2.4), medal, 'base', y)
    placeStreetFurniture(c.placer, block, 'central-plaza', { lights: 56, lightsMainOnly: true, trees: 0, treeKind: 'tree-round', benches: 0, bins: 70, hydrants: 0 })
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) c.placer.add('tree-round', 'central-plaza', cx + sx * 24, cz + sz * 24, 'S', { variant: sx + sz + 4, margin: 2.5 })
    for (const [dx, dz, f] of [[0, -17, 'S'], [0, 17, 'N'], [-17, 0, 'E'], [17, 0, 'W']] as const) c.placer.add('bench', 'central-plaza', cx + dx, cz + dz, f)
    if (id === 'B22') c.placer.add('monument', 'central-plaza', cx, cz, 'S')
    else if (id !== 'B11') {
      for (const [dx, dz, f] of [[-6, 0, 'E'], [6, 0, 'W']] as const) c.placer.add('planter', 'central-plaza', cx + dx, cz + dz, f, { variant: dx + 3 })
      c.placer.add('tree-conifer', 'central-plaza', cx, cz, 'S', { variant: 1, margin: 2 })
    }
    if (id === 'B11') {
      for (const dx of [-22, 22]) c.placer.add('planter', 'central-plaza', cx + dx, cz, 'N', { variant: dx })
    }
  }
}
