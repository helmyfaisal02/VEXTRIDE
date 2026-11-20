import { memo, useEffect, useState } from 'react'
import { CuboidCollider, RigidBody, TrimeshCollider } from '@react-three/rapier'
import { ROAD_TOP } from './cityConfig'
import { CITY } from './cityLayout'
import type { Rect } from './cityTypes'
import { DRIVEWAYS } from './driveways'
import { buildSidewalkGeometry } from './sidewalkGeometry'

/**
 * Static physics for the city: ONE fixed body holding
 *  - one flat slab for everything at road level (roads, junctions, lots), and
 *  - boxes for unchanged sidewalk pieces (0.13 m above the road), and
 *  - three small static triangle meshes for strips containing driveway cuts.
 * 57 colliders in total, matching the visible surface without extra bodies.
 */

function boxProps(r: Rect, top: number) {
  return {
    args: [(r.maxX - r.minX) / 2, top / 2, (r.maxZ - r.minZ) / 2] as [number, number, number],
    position: [(r.minX + r.maxX) / 2, top / 2, (r.minZ + r.maxZ) / 2] as [number, number, number],
  }
}

function CityCollidersImpl() {
  const [ramps] = useState(() => new Map(CITY.sidewalks.filter((s) => DRIVEWAYS.some((d) => d.sidewalkId === s.id)).map((s) => {
    const geometry = buildSidewalkGeometry(s, CITY.blocks.find((b) => b.id === s.blockId)!.rect)
    return [s.id, geometry] as const
  })))
  useEffect(() => () => { for (const g of ramps.values()) g.dispose() }, [ramps])
  return (
    <RigidBody type="fixed" colliders={false} friction={1}>
      <CuboidCollider {...boxProps(CITY.floor, ROAD_TOP)} />
      {CITY.sidewalks.map((s) => {
        const ramp = ramps.get(s.id)
        return ramp
          ? <TrimeshCollider key={s.id} args={[ramp.getAttribute('position').array, ramp.getIndex()!.array]} />
          : <CuboidCollider key={s.id} {...boxProps(s.rect, s.top)} />
      })}
    </RigidBody>
  )
}

export const CityColliders = memo(CityCollidersImpl)
