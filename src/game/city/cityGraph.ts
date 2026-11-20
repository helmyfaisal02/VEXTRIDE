import { CITY } from './cityLayout'
import type { CityLayout, DistrictId } from './cityTypes'

/**
 * Read-only helpers over the road graph. Junctions are nodes, road segments
 * are undirected edges, lane edges are the directed edges vehicles will use.
 * Kept small and generic: traffic AI can build on it without a rebuild.
 */

export function junctionNeighbors(layout: CityLayout, junctionId: string): string[] {
  const j = layout.junctions.find((x) => x.id === junctionId)
  if (!j) return []
  return (['N', 'E', 'S', 'W'] as const).flatMap((d) => (j.neighbors[d] && j.arms[d] ? [j.neighbors[d]] : []))
}

/** Junction ids reachable from `start` over roads. */
export function reachableJunctions(layout: CityLayout, start: string): Set<string> {
  const seen = new Set<string>([start])
  const queue = [start]
  while (queue.length) {
    const id = queue.shift() as string
    for (const next of junctionNeighbors(layout, id)) {
      if (!seen.has(next)) {
        seen.add(next)
        queue.push(next)
      }
    }
  }
  return seen
}

export function isConnected(layout: CityLayout): boolean {
  return reachableJunctions(layout, layout.junctions[0].id).size === layout.junctions.length
}

/** Fewest junction hops between two junctions, or -1 if unreachable. */
export function hopCount(layout: CityLayout, from: string, to: string): number {
  if (from === to) return 0
  const dist = new Map<string, number>([[from, 0]])
  const queue = [from]
  while (queue.length) {
    const id = queue.shift() as string
    for (const next of junctionNeighbors(layout, id)) {
      if (dist.has(next)) continue
      dist.set(next, (dist.get(id) as number) + 1)
      if (next === to) return dist.get(next) as number
      queue.push(next)
    }
  }
  return -1
}

/** Lane edges that can follow `laneId` through its junction, per the legal movements. */
export function nextLanes(layout: CityLayout, laneId: string): string[] {
  return layout.movements.filter((m) => m.from === laneId).map((m) => m.to)
}

export function districtAt(layout: CityLayout, x: number, z: number): DistrictId | null {
  for (const b of layout.blocks) {
    const r = b.rect
    if (x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) return b.districtId
  }
  return null
}

export function getCity(): CityLayout {
  return CITY
}
