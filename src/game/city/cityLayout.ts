import {
  CITY_HALF_EXTENT,
  CITY_SPAWN,
  GRID_LINES,
  LINE_CLASS,
  PERIMETER_WIDTH,
  ROAD_WIDTH,
  SIDEWALK_TOP,
  SIDEWALK_WIDTH,
} from './cityConfig'
import { buildNavigation } from './cityNav'
import type {
  Block,
  CityLayout,
  Direction,
  District,
  DistrictId,
  Junction,
  JunctionType,
  Rect,
  RoadSegment,
  SidewalkSegment,
} from './cityTypes'

/**
 * Builds the whole city description from the grid in `cityConfig`. Pure and
 * deterministic: the same input always yields the same layout, and nothing
 * here touches three.js or React.
 *
 * Every piece is derived from road edges, so roads, junctions and blocks tile
 * the ground exactly, with no gaps or overlaps:
 *   junction rectangle + road rectangles + block rectangles + perimeter = city floor.
 */

const COUNT = GRID_LINES.length

/** Half width (m) of the road running along grid line `i`. */
const halfWidth = (line: number): number => ROAD_WIDTH[LINE_CLASS[line]] / 2

const junctionId = (col: number, row: number) => `J${col}${row}`
const blockId = (col: number, row: number) => `B${col}${row}`

/** District of each block: DISTRICT_GRID[row][col]. Rows run north to south. */
const DISTRICT_GRID: readonly (readonly DistrictId[])[] = [
  ['residential', 'downtown', 'downtown', 'motor-row'],
  ['residential', 'central-plaza', 'central-plaza', 'motor-row'],
  ['riverside', 'central-plaza', 'central-plaza', 'industrial'],
  ['riverside', 'riverside', 'industrial', 'industrial'],
]

const DISTRICT_NAMES: Record<DistrictId, string> = {
  'central-plaza': 'Central Plaza',
  downtown: 'Downtown',
  residential: 'Residential',
  'motor-row': 'Motor Row',
  industrial: 'Warehouse / Industrial',
  riverside: 'Riverside',
}

const DISTRICT_ORDER: readonly DistrictId[] = [
  'central-plaza',
  'downtown',
  'residential',
  'motor-row',
  'industrial',
  'riverside',
]

function junctionType(arms: number, opposite: boolean): JunctionType {
  if (arms >= 4) return 'four-way'
  if (arms === 3) return 't'
  if (arms === 2) return opposite ? 'straight' : 'corner'
  return 'dead-end'
}

function buildJunctions(): Junction[] {
  const out: Junction[] = []
  for (let row = 0; row < COUNT; row++) {
    for (let col = 0; col < COUNT; col++) {
      const x = GRID_LINES[col]
      const z = GRID_LINES[row]
      const hx = halfWidth(col)
      const hz = halfWidth(row)
      const arms: Partial<Record<Direction, string>> = {}
      const neighbors: Partial<Record<Direction, string>> = {}
      if (col > 0) neighbors.W = junctionId(col - 1, row)
      if (col < COUNT - 1) neighbors.E = junctionId(col + 1, row)
      if (row > 0) neighbors.N = junctionId(col, row - 1)
      if (row < COUNT - 1) neighbors.S = junctionId(col, row + 1)
      const n = Object.keys(neighbors).length
      const opposite = (!!neighbors.E && !!neighbors.W) || (!!neighbors.N && !!neighbors.S)
      out.push({
        id: junctionId(col, row),
        col,
        row,
        x,
        z,
        type: junctionType(n, n === 2 && opposite),
        rect: { minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz },
        arms,
        neighbors,
      })
    }
  }
  return out
}

function buildRoads(junctions: Junction[]): RoadSegment[] {
  const roads: RoadSegment[] = []
  const at = (col: number, row: number) => junctions[row * COUNT + col]
  // Roads along X (east-west), one per pair of neighbouring columns on every row.
  for (let row = 0; row < COUNT; row++) {
    for (let col = 0; col < COUNT - 1; col++) {
      const a = at(col, row)
      const b = at(col + 1, row)
      const cls = LINE_CLASS[row]
      const width = ROAD_WIDTH[cls]
      const rect: Rect = { minX: a.rect.maxX, maxX: b.rect.minX, minZ: a.z - width / 2, maxZ: a.z + width / 2 }
      const id = `RX${row}${col}`
      roads.push({ id, class: cls, axis: 'x', width, from: a.id, to: b.id, start: { x: a.x, z: a.z }, end: { x: b.x, z: b.z }, rect, length: rect.maxX - rect.minX })
      a.arms.E = id
      b.arms.W = id
    }
  }
  // Roads along Z (north-south).
  for (let col = 0; col < COUNT; col++) {
    for (let row = 0; row < COUNT - 1; row++) {
      const a = at(col, row)
      const b = at(col, row + 1)
      const cls = LINE_CLASS[col]
      const width = ROAD_WIDTH[cls]
      const rect: Rect = { minX: a.x - width / 2, maxX: a.x + width / 2, minZ: a.rect.maxZ, maxZ: b.rect.minZ }
      const id = `RZ${col}${row}`
      roads.push({ id, class: cls, axis: 'z', width, from: a.id, to: b.id, start: { x: a.x, z: a.z }, end: { x: b.x, z: b.z }, rect, length: rect.maxZ - rect.minZ })
      a.arms.S = id
      b.arms.N = id
    }
  }
  return roads
}

const strip = (minX: number, maxX: number, minZ: number, maxZ: number): Rect => ({ minX, maxX, minZ, maxZ })

/** Sidewalk ring (four strips, corners owned by the north and south strips) inside a block. */
function ringStrips(r: Rect, w: number): Array<[Direction, Rect]> {
  return [
    ['N', strip(r.minX, r.maxX, r.minZ, r.minZ + w)],
    ['S', strip(r.minX, r.maxX, r.maxZ - w, r.maxZ)],
    ['W', strip(r.minX, r.minX + w, r.minZ + w, r.maxZ - w)],
    ['E', strip(r.maxX - w, r.maxX, r.minZ + w, r.maxZ - w)],
  ]
}

function buildBlocks(): { blocks: Block[]; sidewalks: SidewalkSegment[] } {
  const blocks: Block[] = []
  const sidewalks: SidewalkSegment[] = []
  for (let row = 0; row < COUNT - 1; row++) {
    for (let col = 0; col < COUNT - 1; col++) {
      const rect: Rect = {
        minX: GRID_LINES[col] + halfWidth(col),
        maxX: GRID_LINES[col + 1] - halfWidth(col + 1),
        minZ: GRID_LINES[row] + halfWidth(row),
        maxZ: GRID_LINES[row + 1] - halfWidth(row + 1),
      }
      const districtId = DISTRICT_GRID[row][col]
      const paved = districtId === 'central-plaza'
      const id = blockId(col, row)
      const ids: string[] = []
      if (paved) {
        ids.push(`${id}-plaza`)
        sidewalks.push({ id: `${id}-plaza`, blockId: id, side: 'plaza', rect, top: SIDEWALK_TOP })
      } else {
        for (const [side, strip] of ringStrips(rect, SIDEWALK_WIDTH)) {
          ids.push(`${id}-${side}`)
          sidewalks.push({ id: `${id}-${side}`, blockId: id, side, rect: strip, top: SIDEWALK_TOP })
        }
      }
      const lot: Rect | null = paved
        ? null
        : { minX: rect.minX + SIDEWALK_WIDTH, maxX: rect.maxX - SIDEWALK_WIDTH, minZ: rect.minZ + SIDEWALK_WIDTH, maxZ: rect.maxZ - SIDEWALK_WIDTH }
      blocks.push({ id, col, row, districtId, rect, paved, lot, sidewalks: ids })
    }
  }
  return { blocks, sidewalks }
}

/** Outer sidewalk that closes the city edge, outside the perimeter road. */
function buildPerimeter(): SidewalkSegment[] {
  const e = CITY_HALF_EXTENT
  const inner = e - PERIMETER_WIDTH
  const parts: Array<[string, Rect]> = [
    ['N', strip(-e, e, -e, -inner)],
    ['S', strip(-e, e, inner, e)],
    ['W', strip(-e, -inner, -inner, inner)],
    ['E', strip(inner, e, -inner, inner)],
  ]
  return parts.map(([side, rect]) => ({ id: `P-${side}`, blockId: null, side: 'perimeter', rect, top: SIDEWALK_TOP }))
}

function union(a: Rect, b: Rect): Rect {
  return { minX: Math.min(a.minX, b.minX), maxX: Math.max(a.maxX, b.maxX), minZ: Math.min(a.minZ, b.minZ), maxZ: Math.max(a.maxZ, b.maxZ) }
}

function buildDistricts(blocks: Block[]): District[] {
  return DISTRICT_ORDER.map((id) => {
    const own = blocks.filter((b) => b.districtId === id)
    const rects = own.map((b) => b.rect)
    const bounds = rects.reduce(union)
    const roadIds = new Set<string>()
    for (const b of own) {
      roadIds.add(`RX${b.row}${b.col}`)
      roadIds.add(`RX${b.row + 1}${b.col}`)
      roadIds.add(`RZ${b.col}${b.row}`)
      roadIds.add(`RZ${b.col + 1}${b.row}`)
    }
    return {
      id,
      name: DISTRICT_NAMES[id],
      blockIds: own.map((b) => b.id),
      rects,
      bounds,
      center: { x: (bounds.minX + bounds.maxX) / 2, z: (bounds.minZ + bounds.maxZ) / 2 },
      roadIds: [...roadIds].sort(),
    }
  })
}

export function buildCityLayout(): CityLayout {
  const junctions = buildJunctions()
  const roads = buildRoads(junctions)
  const { blocks, sidewalks } = buildBlocks()
  const e = CITY_HALF_EXTENT
  const layout: CityLayout = {
    junctions,
    roads,
    blocks,
    districts: buildDistricts(blocks),
    sidewalks: [...sidewalks, ...buildPerimeter()],
    connectionPoints: [],
    laneEdges: [],
    movements: [],
    floor: { minX: -e, maxX: e, minZ: -e, maxZ: e },
    spawn: { x: CITY_SPAWN.x, z: CITY_SPAWN.z, surfaceY: SIDEWALK_TOP },
  }
  const nav = buildNavigation(junctions, roads)
  layout.connectionPoints = nav.connectionPoints
  layout.laneEdges = nav.laneEdges
  layout.movements = nav.movements
  return layout
}

/** The city layout. Built once; it never changes at runtime. */
export const CITY: CityLayout = buildCityLayout()
