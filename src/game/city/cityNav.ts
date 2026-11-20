import type {
  ConnectionPoint,
  Direction,
  Junction,
  LaneEdge,
  Movement,
  RoadSegment,
  TurnKind,
} from './cityTypes'

/**
 * Vehicle navigation data derived from the road layout: connection points,
 * one directed lane edge per direction of travel, and the legal movements
 * through each junction. Traffic is right-handed. With north = -Z, a vehicle
 * heading east keeps to the south (+Z) side of the road, and so on.
 *
 * This is data only. No vehicle or AI uses it yet.
 */

export interface Navigation {
  connectionPoints: ConnectionPoint[]
  laneEdges: LaneEdge[]
  movements: Movement[]
}

/** Lane centres sit a quarter of the road width either side of the centreline. */
const LANE_OFFSET_FRACTION = 0.25

function lane(road: RoadSegment, forward: boolean, suffix: Direction): LaneEdge {
  const o = road.width * LANE_OFFSET_FRACTION
  const cx = road.start.x
  const cz = road.start.z
  if (road.axis === 'x') {
    const z = cz + (forward ? o : -o)
    const [x1, x2] = forward ? [road.rect.minX, road.rect.maxX] : [road.rect.maxX, road.rect.minX]
    return {
      id: `${road.id}:${suffix}`,
      roadId: road.id,
      from: forward ? road.from : road.to,
      to: forward ? road.to : road.from,
      dir: { x: forward ? 1 : -1, z: 0 },
      start: { x: x1, z },
      end: { x: x2, z },
      length: road.length,
    }
  }
  const x = cx + (forward ? -o : o)
  const [z1, z2] = forward ? [road.rect.minZ, road.rect.maxZ] : [road.rect.maxZ, road.rect.minZ]
  return {
    id: `${road.id}:${suffix}`,
    roadId: road.id,
    from: forward ? road.from : road.to,
    to: forward ? road.to : road.from,
    dir: { x: 0, z: forward ? 1 : -1 },
    start: { x, z: z1 },
    end: { x, z: z2 },
    length: road.length,
  }
}

/** Heading change between two unit headings (z points south): right turns have a positive cross product. */
export function turnKind(a: { x: number; z: number }, b: { x: number; z: number }): TurnKind {
  const dot = a.x * b.x + a.z * b.z
  if (dot > 0.99) return 'straight'
  return a.x * b.z - a.z * b.x > 0 ? 'right' : 'left'
}

export function buildNavigation(junctions: Junction[], roads: RoadSegment[]): Navigation {
  const connectionPoints: ConnectionPoint[] = []
  for (const j of junctions) {
    for (const dir of ['N', 'E', 'S', 'W'] as const) {
      const roadId = j.arms[dir]
      if (!roadId) continue
      const x = dir === 'E' ? j.rect.maxX : dir === 'W' ? j.rect.minX : j.x
      const z = dir === 'S' ? j.rect.maxZ : dir === 'N' ? j.rect.minZ : j.z
      connectionPoints.push({ id: `${j.id}:${dir}`, junctionId: j.id, direction: dir, roadId, x, z })
    }
  }

  const laneEdges: LaneEdge[] = []
  for (const road of roads) {
    laneEdges.push(lane(road, true, road.axis === 'x' ? 'E' : 'S'))
    laneEdges.push(lane(road, false, road.axis === 'x' ? 'W' : 'N'))
  }

  const movements: Movement[] = []
  for (const j of junctions) {
    const arriving = laneEdges.filter((l) => l.to === j.id)
    const leaving = laneEdges.filter((l) => l.from === j.id)
    for (const inLane of arriving) {
      for (const outLane of leaving) {
        // No U-turns: never leave along the road you arrived on.
        if (outLane.roadId === inLane.roadId) continue
        movements.push({
          id: `${j.id}:${inLane.id}>${outLane.id}`,
          junctionId: j.id,
          from: inLane.id,
          to: outLane.id,
          kind: turnKind(inLane.dir, outLane.dir),
        })
      }
    }
  }
  return { connectionPoints, laneEdges, movements }
}
