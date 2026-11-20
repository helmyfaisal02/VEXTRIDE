import { memo } from 'react'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { ENVIRONMENT } from './envLayout'

/**
 * Static physics for buildings and gameplay-relevant props: one fixed body
 * holding one simple cuboid per object. Visual detail (windows, awnings, roofs,
 * crowns) never adds colliders; trees collide only as trunks.
 */
function EnvCollidersImpl() {
  return (
    <RigidBody type="fixed" colliders={false} friction={0.4}>
      {ENVIRONMENT.colliders.map((c) => (
        <CuboidCollider
          key={c.id}
          args={[(c.rect.maxX - c.rect.minX) / 2, (c.y1 - c.y0) / 2, (c.rect.maxZ - c.rect.minZ) / 2]}
          position={[(c.rect.minX + c.rect.maxX) / 2, (c.y0 + c.y1) / 2, (c.rect.minZ + c.rect.maxZ) / 2]}
        />
      ))}
    </RigidBody>
  )
}

export const EnvColliders = memo(EnvCollidersImpl)
