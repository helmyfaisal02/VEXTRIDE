import type { RapierRigidBody } from '@react-three/rapier'
import {
  CAPSULE_HALF_SEGMENT,
  CAPSULE_RADIUS,
  CEILING,
  CHARACTER_HEIGHT,
  FEET_OFFSET,
  FIXED_DT,
  GROUND_PROBE,
  STEP,
} from './config'

/**
 * Ray probes the character controller uses to read the world: floor below,
 * ceiling above, and ledges ahead. All are short casts from the capsule, made
 * once per fixed step, against the real Rapier world.
 */

export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface RayLike {
  origin: Vec3
  dir: Vec3
}

/** The slice of Rapier's `World` the probes use. */
export interface QueryWorld {
  castRayAndGetNormal(
    ray: RayLike,
    maxToi: number,
    solid: boolean,
    filterFlags?: number,
    filterGroups?: number,
    filterExcludeCollider?: never,
    filterExcludeRigidBody?: RapierRigidBody,
  ): { timeOfImpact: number; normal: Vec3 } | null
}

/** Outcome of `detectStep`. Reused every step so probing allocates nothing. */
export interface StepProbeResult {
  /** Feet height to lift to, or null when there is nothing to climb. */
  target: number | null
  /**
   * True when a low obstacle just over the step limit (or one with no headroom)
   * is ahead. The round capsule can roll up such things on its own, so the
   * controller removes the velocity pushing into it. `nx`/`nz` is the face
   * normal on the ground plane, pointing back toward the character.
   */
  wall: boolean
  nx: number
  nz: number
}

export interface CharacterProbe {
  world: QueryWorld
  /** One reusable ray; probes overwrite its origin and direction. */
  ray: RayLike
  /** Query flags that skip dynamic bodies and sensors (static level geometry only). */
  staticFlags: number
  step: StepProbeResult
}

export function createStepProbeResult(): StepProbeResult {
  return { target: null, wall: false, nx: 0, nz: 0 }
}

/** Surfaces at least this level count as floor; steeper ones count as walls. */
export const MIN_WALKABLE_NORMAL_Y = Math.cos(GROUND_PROBE.maxSlopeAngle)

const SPREAD_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [GROUND_PROBE.spread, 0],
  [-GROUND_PROBE.spread, 0],
  [0, GROUND_PROBE.spread],
  [0, -GROUND_PROBE.spread],
]
const LATERAL_OFFSETS: readonly number[] = [0, STEP.lateral, -STEP.lateral]

function setRay(ray: RayLike, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number): void {
  ray.origin.x = ox
  ray.origin.y = oy
  ray.origin.z = oz
  ray.dir.x = dx
  ray.dir.y = dy
  ray.dir.z = dz
}

/**
 * Casts short rays straight down from the capsule (centre plus four around it)
 * and returns the gap between the feet and the nearest walkable surface, or
 * `Infinity` when there is none in range. The gap is corrected for slope tilt,
 * so a capsule resting on any walkable slope reads ~0. While falling, the
 * range grows with the distance covered in one step, so a landing is seen
 * before it happens. The character's own body is excluded.
 */
export function probeGround(probe: CharacterProbe, body: RapierRigidBody): number {
  const t = body.translation()
  const fall = Math.max(0, -body.linvel().y) * FIXED_DT
  const maxToi = FEET_OFFSET + GROUND_PROBE.reach + CAPSULE_RADIUS + fall
  let gap = Infinity
  for (const [ox, oz] of SPREAD_OFFSETS) {
    setRay(probe.ray, t.x + ox, t.y, t.z + oz, 0, -1, 0)
    const hit = probe.world.castRayAndGetNormal(probe.ray, maxToi, true, undefined, undefined, undefined, body)
    if (!hit || hit.normal.y < MIN_WALKABLE_NORMAL_Y) continue
    const slopeCorrection = CAPSULE_RADIUS * (1 / hit.normal.y - 1)
    gap = Math.min(gap, hit.timeOfImpact - FEET_OFFSET - slopeCorrection)
  }
  return gap
}

/**
 * How far the head can still rise before touching static geometry above
 * (`Infinity` when clear for `rise` plus a small pad). Accounts for the
 * rounded top of the capsule at each probe position.
 */
export function probeCeiling(probe: CharacterProbe, body: RapierRigidBody, rise: number): number {
  const t = body.translation()
  const top = CAPSULE_HALF_SEGMENT + CAPSULE_RADIUS
  const maxToi = top + rise + CEILING.lookPad
  let allowed = Infinity
  for (const [ox, oz] of SPREAD_OFFSETS) {
    setRay(probe.ray, t.x + ox, t.y, t.z + oz, 0, 1, 0)
    const hit = probe.world.castRayAndGetNormal(
      probe.ray,
      maxToi,
      true,
      probe.staticFlags,
      undefined,
      undefined,
      body,
    )
    if (!hit) continue
    const lateral = Math.hypot(ox, oz)
    const capsuleTop = CAPSULE_HALF_SEGMENT + Math.sqrt(CAPSULE_RADIUS * CAPSULE_RADIUS - lateral * lateral)
    allowed = Math.min(allowed, hit.timeOfImpact - capsuleTop)
  }
  return allowed
}

/**
 * Looks ahead along the horizontal direction of travel for a climbable ledge
 * and fills `probe.step`. A ledge qualifies only when ALL hold:
 *  - a steep face is hit by a low ray (shallow slopes are left to the solver),
 *  - nothing is hit at `maxHeight` + margin (anything taller is a wall),
 *  - the surface just beyond the face is level and between `minRise` and `maxHeight` high,
 *  - there is full standing headroom above that surface.
 */
export function detectStep(
  probe: CharacterProbe,
  body: RapierRigidBody,
  dirX: number,
  dirZ: number,
  speed: number,
): StepProbeResult {
  const out = probe.step
  out.target = null
  out.wall = false

  const t = body.translation()
  const feetY = t.y - FEET_OFFSET
  const length = CAPSULE_RADIUS + STEP.lookahead + speed * FIXED_DT
  const sideX = -dirZ
  const sideZ = dirX
  const { world, ray, staticFlags } = probe

  // 1. A steep face low down?
  const lowY = feetY + STEP.lowRayHeight
  let faceDistance = Infinity
  let faceNx = 0
  let faceNz = 0
  for (const off of LATERAL_OFFSETS) {
    setRay(ray, t.x + sideX * off, lowY, t.z + sideZ * off, dirX, 0, dirZ)
    const hit = world.castRayAndGetNormal(ray, length, true, staticFlags, undefined, undefined, body)
    if (hit && hit.normal.y < MIN_WALKABLE_NORMAL_Y && hit.timeOfImpact < faceDistance) {
      faceDistance = hit.timeOfImpact
      faceNx = hit.normal.x
      faceNz = hit.normal.z
    }
  }
  if (faceDistance === Infinity) return out

  // 2. Anything above the limit in the same place means it is a wall: the
  //    solver stops the capsule against it, so there is nothing to do.
  const highY = feetY + STEP.maxHeight + STEP.highMargin
  for (const off of LATERAL_OFFSETS) {
    setRay(ray, t.x + sideX * off, highY, t.z + sideZ * off, dirX, 0, dirZ)
    const hit = world.castRayAndGetNormal(
      ray,
      length + STEP.topSample + 0.02,
      true,
      staticFlags,
      undefined,
      undefined,
      body,
    )
    if (hit) return out
  }

  // From here on a low obstacle is confirmed: if it cannot be climbed, guard against it.
  const flagWall = () => {
    const n = Math.hypot(faceNx, faceNz)
    out.wall = true
    out.nx = n > 1e-3 ? faceNx / n : -dirX
    out.nz = n > 1e-3 ? faceNz / n : -dirZ
    return out
  }

  // 3. A level top just beyond the face, within the height limit.
  const sampleX = t.x + dirX * (faceDistance + STEP.topSample)
  const sampleZ = t.z + dirZ * (faceDistance + STEP.topSample)
  setRay(ray, sampleX, highY, sampleZ, 0, -1, 0)
  const top = world.castRayAndGetNormal(
    ray,
    highY - feetY + 0.05,
    true,
    staticFlags,
    undefined,
    undefined,
    body,
  )
  if (!top || top.normal.y < MIN_WALKABLE_NORMAL_Y) return flagWall()
  const surfaceY = highY - top.timeOfImpact
  const rise = surfaceY - feetY
  if (rise < STEP.minRise) return out
  if (rise > STEP.maxHeight + 0.005) return flagWall()

  // 4. Room to stand on it.
  setRay(ray, sampleX, surfaceY + 0.02, sampleZ, 0, 1, 0)
  const ceiling = world.castRayAndGetNormal(
    ray,
    CHARACTER_HEIGHT - 0.02,
    true,
    staticFlags,
    undefined,
    undefined,
    body,
  )
  if (ceiling) return flagWall()

  out.target = surfaceY + STEP.clearance
  return out
}
