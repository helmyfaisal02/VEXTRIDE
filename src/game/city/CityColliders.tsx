import { memo } from 'react'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { ROAD_TOP } from './cityConfig'
import { CITY } from './cityLayout'
import type { Rect } from './cityTypes'

/**
 * Static physics for the city: ONE fixed body holding
 *  - one flat slab for everything at road level (roads, junctions, lots), and
 *  - one box per sidewalk piece (raised 0.16 m, so the curb is 0.13 m).
 * About 60 cuboids in total, all matching the visible geometry exactly.
 */

function boxProps(r: Rect, top: number) {
  return {
    args: [(r.maxX - r.minX) / 2, top / 2, (r.maxZ - r.minZ) / 2] as [number, number, number],
    position: [(r.minX + r.maxX) / 2, top / 2, (r.minZ + r.maxZ) / 2] as [number, number, number],
  }
}

function CityCollidersImpl() {
  return (
    <RigidBody type="fixed" colliders={false} friction={1}>
      <CuboidCollider {...boxProps(CITY.floor, ROAD_TOP)} />
      {CITY.sidewalks.map((s) => (
        <CuboidCollider key={s.id} {...boxProps(s.rect, s.top)} />
      ))}
    </RigidBody>
  )
}

export const CityColliders = memo(CityCollidersImpl)
