import { ROAD_TOP } from './cityConfig'
import { CITY } from './cityLayout'
import type { CityLayout, Rect } from './cityTypes'
import { sidewalkHeight } from './driveways'

const within = (r: Rect, x: number, z: number) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ

/**
 * Height of the walkable surface at (x, z): raised sidewalk and plaza pieces,
 * the road-level floor (roads, junctions, lots), or open ground outside the
 * city. This is the reference both the render geometry and the physics
 * colliders are checked against.
 */
export function surfaceHeightAt(x: number, z: number, layout: CityLayout = CITY): number {
  for (const s of layout.sidewalks) if (within(s.rect, x, z)) return sidewalkHeight(x, s)
  return within(layout.floor, x, z) ? ROAD_TOP : 0
}
