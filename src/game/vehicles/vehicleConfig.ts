import { motorParking } from '../city/driveways'
import { ROAD_TOP } from '../city/cityConfig'

const pad = motorParking().north
export const COUPE = {
  name: 'VEXTRIDE Street Coupe',
  length: 4.2, width: 1.8, height: 1.4,
  wheelRadius: 0.32, wheelbase: 2.64,
  maxSpeed: 22, reverseSpeed: 7,
  acceleration: 8, reverseAcceleration: 5, brake: 16, coast: 2,
  entryRange: 3, exitSpeed: 1,
  /** Existing north parking stall, facing the central aisle, outside the curb-cut throat. */
  spawn: { x: pad.minX + 1 + 2.8 * 5.5, y: ROAD_TOP + 0.52, z: pad.minZ + 3.5 },
  spawnYaw: Math.PI,
} as const
export const WHEELS = [
  { x: -0.79, z: -1.32, front: true }, { x: 0.79, z: -1.32, front: true },
  { x: -0.79, z: 1.32, front: false }, { x: 0.79, z: 1.32, front: false },
] as const

export const CHASSIS_COLLIDERS = [
  { half: [.84,.27,2.08] as [number,number,number], position: [0,-.03,0] as [number,number,number], mass: 1000 },
  { half: [.65,.30,.75] as [number,number,number], position: [0,.57,.1] as [number,number,number], mass: 30 },
] as const
