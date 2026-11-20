import type { Vector3Tuple } from 'three'
import { CITY_SPAWN, SIDEWALK_TOP } from '../city/cityConfig'

/** Fixed simulation step shared by the physics world and the controller. */
export const FIXED_DT = 1 / 60

/** Capsule: total height = 2 * (HALF_SEGMENT + RADIUS) = 1.8 m. */
export const CAPSULE_RADIUS = 0.3
export const CAPSULE_HALF_SEGMENT = 0.6
export const CHARACTER_HEIGHT = 2 * (CAPSULE_HALF_SEGMENT + CAPSULE_RADIUS)
/** Distance from the capsule centre (body origin) down to the feet. */
export const FEET_OFFSET = CHARACTER_HEIGHT / 2

/** Capsule centre at spawn: the Central Plaza pavement, with the feet starting 0.3 m above it. */
export const SPAWN_POSITION: Vector3Tuple = [CITY_SPAWN.x, SIDEWALK_TOP + FEET_OFFSET + 0.3, CITY_SPAWN.z]
/** Falling below this y respawns the character at the spawn point. */
export const KILL_PLANE_Y = -30

export const WORLD_GRAVITY = 9.81

export const MOVE = {
  walkSpeed: 3.6,
  sprintSpeed: 7.2,
  /** Horizontal acceleration / deceleration in m/s^2. */
  groundAccel: 34,
  groundDecel: 46,
  airAccel: 12,
  airDecel: 4,
  /** Gravity for the character; stronger than world gravity for a snappier jump. */
  gravity: 24,
  jumpSpeed: 8.2,
  terminalVelocity: 45,
  /** Seconds after leaving a ledge during which a jump is still allowed. */
  coyoteTime: 0.08,
  /** Seconds a jump press is remembered while waiting to land. */
  jumpBuffer: 0.1,
  /** After taking off, ground contact is ignored this long so a jump can't re-trigger. */
  jumpAirLock: 0.15,
} as const

/** Applied to the body so its gravity equals `MOVE.gravity` under world gravity. */
export const GRAVITY_SCALE = MOVE.gravity / WORLD_GRAVITY

export const GROUND_PROBE = {
  /** How far below the capsule's feet a surface still counts as ground. */
  reach: 0.12,
  /** Feet must be this close to the surface before the body is held in place at rest. */
  restGap: 0.015,
  /** Horizontal spread of the extra probe rays, so ledges still register. */
  spread: 0.2,
  /** Steepest surface (radians) that counts as walkable ground. */
  maxSlopeAngle: (55 * Math.PI) / 180,
} as const

/**
 * Step-up: lets the dynamic capsule climb sidewalk-height ledges. A ray probe
 * confirms a low, steep face with a flat top no higher than `maxHeight` and
 * nothing taller in the way; the body is then lifted by setting its vertical
 * velocity (never its position), so Rapier still resolves every collision.
 */
export const STEP = {
  /** Tallest ledge that can be climbed (metres above the feet). */
  maxHeight: 0.2,
  /** Ledges lower than this are left to the solver. */
  minRise: 0.015,
  /** Height above the feet of the rays that look for a ledge face. */
  lowRayHeight: 0.05,
  /** The blocking ray sits this far above `maxHeight`, so taller things are walls. */
  highMargin: 0.1,
  /** Look-ahead beyond the capsule surface, plus one step of travel. */
  lookahead: 0.06,
  /** How far past the ledge face the top surface is sampled. */
  topSample: 0.05,
  /** Sideways spread of the face rays (so corners of ledges still register). */
  lateral: 0.2,
  /** Cap on the lifting speed (m/s): no vertical launches. */
  climbSpeed: 3.5,
  /** Feet end this far above the ledge top. */
  clearance: 0.015,
  /** Climb is complete when the feet are within this of the target. */
  tolerance: 0.012,
  /** Hard cap on consecutive climbing steps. */
  maxSteps: 12,
  /** Steps with (almost) no upward progress before the climb is abandoned. */
  maxStall: 2,
  minProgress: 0.004,
  /** The feet must be this close to the floor for a climb to start. */
  maxGroundGap: 0.04,
  /** Minimum desired horizontal speed for a climb to start. */
  minSpeed: 0.5,
} as const

/** Ceiling handling: rising speed is limited so the head stops at the surface. */
export const CEILING = {
  /** Gap kept between the head and the ceiling. */
  skin: 0.004,
  /** Extra ray length beyond the planned rise. */
  lookPad: 0.05,
} as const

/** Landing: descent is limited so the capsule arrives touching the floor, not inside it. */
export const LANDING = {
  skin: 0.002,
} as const
