import type { RoadClass } from './cityConfig'

/** Axis-aligned rectangle on the ground plane (world X/Z, metres). */
export interface Rect {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

export type Direction = 'N' | 'E' | 'S' | 'W'
export type JunctionType = 'four-way' | 't' | 'corner' | 'straight' | 'dead-end'
export type DistrictId =
  | 'central-plaza'
  | 'downtown'
  | 'residential'
  | 'motor-row'
  | 'industrial'
  | 'riverside'

/** An intersection. Its surface is the rectangle where the two roads cross. */
export interface Junction {
  id: string
  col: number
  row: number
  x: number
  z: number
  type: JunctionType
  /** Surface rectangle (asphalt). */
  rect: Rect
  /** Road segment leaving in each direction, if any. */
  arms: Partial<Record<Direction, string>>
  /** Neighbouring junction in each direction, if any. */
  neighbors: Partial<Record<Direction, string>>
}

/** A straight road between two adjacent junctions. */
export interface RoadSegment {
  id: string
  class: RoadClass
  axis: 'x' | 'z'
  width: number
  /** Junction at the lower-coordinate end, then the higher one. */
  from: string
  to: string
  /** Centreline end points, taken at the junction centres. */
  start: { x: number; z: number }
  end: { x: number; z: number }
  /** Asphalt surface, running between the two junction rectangles. */
  rect: Rect
  length: number
}

export interface SidewalkSegment {
  id: string
  blockId: string | null
  /** Which side of its block the strip is on, or `perimeter` for the city edge. */
  side: Direction | 'perimeter' | 'plaza'
  rect: Rect
  /** Top height above the ground plane. */
  top: number
}

/** One city block: the area between four roads. */
export interface Block {
  id: string
  col: number
  row: number
  districtId: DistrictId
  /** Area bounded by road edges. */
  rect: Rect
  /** Raised paved plaza (whole block) rather than a sidewalk ring around a lot. */
  paved: boolean
  /** The lot inside the sidewalk ring, for future buildings. Null for paved blocks. */
  lot: Rect | null
  sidewalks: string[]
}

export interface District {
  id: DistrictId
  name: string
  blockIds: string[]
  rects: Rect[]
  bounds: Rect
  center: { x: number; z: number }
  /** Road segments that run along the district's blocks. */
  roadIds: string[]
}

/** Where a road meets a junction; a place a vehicle path can start or end. */
export interface ConnectionPoint {
  id: string
  junctionId: string
  direction: Direction
  roadId: string
  /** Centre of the road end at the junction edge. */
  x: number
  z: number
}

/** One travel lane in one direction along a road: a directed edge for vehicle navigation. */
export interface LaneEdge {
  id: string
  roadId: string
  from: string
  to: string
  /** Unit heading. */
  dir: { x: number; z: number }
  /** Lane centreline start and end, at the junction edges. */
  start: { x: number; z: number }
  end: { x: number; z: number }
  length: number
}

export type TurnKind = 'straight' | 'left' | 'right'

/** A legal way through a junction from an arriving lane to a leaving lane. */
export interface Movement {
  id: string
  junctionId: string
  from: string
  to: string
  kind: TurnKind
}

export interface CityLayout {
  junctions: Junction[]
  roads: RoadSegment[]
  blocks: Block[]
  districts: District[]
  sidewalks: SidewalkSegment[]
  connectionPoints: ConnectionPoint[]
  laneEdges: LaneEdge[]
  movements: Movement[]
  /** Area that is solid ground for the city (roads, lots, sidewalks). */
  floor: Rect
  spawn: { x: number; z: number; surfaceY: number }
}
