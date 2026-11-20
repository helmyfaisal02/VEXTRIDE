import type { useRapier } from '@react-three/rapier'
import type { Vector3 } from 'three'
import { damp } from '../shared/math'

type Physics = Pick<ReturnType<typeof useRapier>, 'world' | 'rapier'>
export const CAMERA_PROBE_RADIUS = 0.24
export const CAMERA_SKIN = 0.06
const IDENTITY = { x: 0, y: 0, z: 0, w: 1 }

/** Sweep a reusable camera volume, ignoring player/crates and sensors. */
export function cameraClearance(physics: Physics, origin: Vector3, direction: Vector3, distance: number, probe: InstanceType<Physics['rapier']['Ball']>): number {
  if (distance <= 1e-6) return 0
  const flags = physics.rapier.QueryFilterFlags.EXCLUDE_DYNAMIC |
    physics.rapier.QueryFilterFlags.EXCLUDE_KINEMATIC |
    physics.rapier.QueryFilterFlags.EXCLUDE_SENSORS
  const hit = physics.world.castShape(origin, IDENTITY, direction, probe, 0, distance, true, flags)
  return hit ? Math.max(0, Math.min(distance, hit.time_of_impact - CAMERA_SKIN)) : distance
}

/** Never ease through an obstacle; keep the established slow release after it clears. */
export function stepCameraDistance(current: number, allowed: number, dt: number): number {
  return Math.min(allowed, damp(current, allowed, 5, dt))
}
