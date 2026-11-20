/**
 * VEXTRIDE City: shared dimensions. 1 unit = 1 metre. X is east, Z is south
 * (so "north" is -Z), Y is up. The city is centred on the world origin.
 */

/** Grid lines (road centrelines), identical on both axes: 4 x 4 blocks of 80 m. */
export const GRID_LINES: readonly number[] = [-160, -80, 0, 80, 160]

export type RoadClass = 'main' | 'secondary'

/** Road widths (m). Lines 0, 2, 4 are main roads, lines 1 and 3 secondary. */
export const ROAD_WIDTH: Record<RoadClass, number> = { main: 14, secondary: 9 }
export const LINE_CLASS: readonly RoadClass[] = ['main', 'secondary', 'main', 'secondary', 'main']

export const SIDEWALK_WIDTH = 2.5
/** Width of the lighter curb band along a sidewalk's road edge. */
export const CURB_BAND = 0.3
/** Width of the sidewalk strip that closes the outer edge of the city. */
export const PERIMETER_WIDTH = 3

/** Heights above the world ground plane (y = 0). */
export const ROAD_TOP = 0.03
export const CURB_HEIGHT = 0.13
export const SIDEWALK_TOP = ROAD_TOP + CURB_HEIGHT

/** Playable city bounds: the footprint of the road network and its perimeter sidewalk. */
export const CITY_HALF_EXTENT = 170
/** Planned playable area (m). */
export const CITY_SIZE = CITY_HALF_EXTENT * 2

/** Marking dimensions (m). */
export const MARKING = {
  /** Lift above the road surface (with polygon offset this prevents z-fighting). */
  lift: 0.008,
  line: 0.15,
  doubleGap: 0.15,
  dashLength: 3,
  dashGap: 5,
  crosswalkDepth: 3,
  crosswalkStripe: 0.5,
  crosswalkGap: 0.5,
  stopLineDepth: 0.5,
  /** Gap between the junction and the crosswalk. */
  junctionClearance: 0.4,
  stopLineClearance: 1.5,
} as const

/**
 * Plaza spawn: the centre of the north-west plaza block, the block that touches
 * the central crossing. Derived from the grid so it stays in sync with the layout.
 */
function plazaSpawnCoordinate(): number {
  const [, west, centre] = GRID_LINES
  const westEdge = west + ROAD_WIDTH.secondary / 2
  const centreEdge = centre - ROAD_WIDTH.main / 2
  return (westEdge + centreEdge) / 2
}
export const CITY_SPAWN = { x: plazaSpawnCoordinate(), z: plazaSpawnCoordinate() } as const

export const DISTRICT_COLORS = {
  'central-plaza': '#d8d2c4',
  downtown: '#8c98a8',
  residential: '#86b36e',
  'motor-row': '#b58a6c',
  industrial: '#9d978b',
  riverside: '#6fa9c6',
} as const

export const SURFACE_COLORS = {
  asphalt: '#34373e',
  markingWhite: '#f1f0ea',
  markingYellow: '#f0c33c',
  sidewalk: '#bdb8ae',
  curb: '#d9d5cb',
  driveway: '#a7a49b',
  plaza: '#d8d2c4',
} as const

/** Phase 1 demo objects and the step test area live here, east of the city. */
export const DEMO_YARD_ORIGIN = { x: 260, z: 0 } as const
