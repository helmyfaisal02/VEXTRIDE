import type { RapierRigidBody } from '@react-three/rapier'
import type { InputState } from '../input/inputState'
import { detectStep, probeCeiling, type CharacterProbe } from './characterProbes'
import {
  CEILING,
  FEET_OFFSET,
  FIXED_DT,
  GRAVITY_SCALE,
  GROUND_PROBE,
  KILL_PLANE_Y,
  LANDING,
  MOVE,
  SPAWN_POSITION,
  STEP,
} from './config'
import { playerState } from './playerState'

export interface CharacterSim {
  /** Horizontal velocity (m/s) requested of the body, smoothed toward the input target. */
  hvx: number
  hvz: number
  grounded: boolean
  coyote: number
  jumpBuffer: number
  /** Seconds after a jump during which ground contact is ignored (the probe still sees the floor). */
  airLock: number
  /** Last valid camera forward direction on the ground plane. */
  fwdX: number
  fwdZ: number
  /** Step-up state: true while the body is being lifted onto a ledge. */
  stepActive: boolean
  stepTarget: number
  stepLeft: number
  stepStall: number
  stepLastFeet: number
  /** Set when a climb ends so any leftover upward velocity is cancelled. */
  stepFinishing: boolean
}

export function createCharacterSim(): CharacterSim {
  return {
    hvx: 0,
    hvz: 0,
    grounded: false,
    coyote: 0,
    jumpBuffer: 0,
    airLock: 0,
    fwdX: 0,
    fwdZ: -1,
    stepActive: false,
    stepTarget: 0,
    stepLeft: 0,
    stepStall: 0,
    stepLastFeet: 0,
    stepFinishing: false,
  }
}

/** Moves `current` toward `target` by at most `maxDelta` (no overshoot). */
function approach(current: number, target: number, maxDelta: number): number {
  const d = target - current
  return Math.abs(d) <= maxDelta ? target : current + Math.sign(d) * maxDelta
}

/**
 * Advances the character by one fixed step (`FIXED_DT`), before the physics
 * world integrates it.
 *
 * The body is a dynamic, rotation-locked capsule. Each step this sets only its
 * velocity (never its position), so Rapier's contact solver does all collision
 * response: sliding along walls, riding slopes, pushing crates, stopping on
 * the ground. Three probe-based refinements sit on top of that:
 *
 * - Step-up: a ledge up to `STEP.maxHeight` is climbed by lifting velocity,
 *   capped at `STEP.climbSpeed`, only after the probes confirm a steep face, a
 *   level top and no taller obstacle (see `detectStep`).
 * - Ceiling: rising speed is limited to the space above the head, so the
 *   capsule stops at the surface instead of overshooting into it.
 * - Landing: descent speed is limited to the space below the feet, so it
 *   arrives touching the floor instead of sinking in and being pushed out.
 *
 * `camX`/`camZ` is the camera's forward direction (any length; the vertical
 * component should already be dropped). Movement is camera-relative.
 * Consumes `input.jumpQueued`.
 */
export function stepCharacter(
  s: CharacterSim,
  input: InputState,
  camX: number,
  camZ: number,
  body: RapierRigidBody,
  groundGap: number,
  probe: CharacterProbe,
): void {
  const dt = FIXED_DT
  const lv = body.linvel()
  s.airLock = Math.max(0, s.airLock - dt)
  s.grounded = groundGap <= GROUND_PROBE.reach && s.airLock === 0

  const fl = Math.hypot(camX, camZ)
  if (fl > 1e-3) {
    s.fwdX = camX / fl
    s.fwdZ = camZ / fl
  }
  const rightX = -s.fwdZ
  const rightZ = s.fwdX

  const axisForward = (input.forward ? 1 : 0) - (input.backward ? 1 : 0)
  const axisRight = (input.right ? 1 : 0) - (input.left ? 1 : 0)
  let mx = s.fwdX * axisForward + rightX * axisRight
  let mz = s.fwdZ * axisForward + rightZ * axisRight
  const ml = Math.hypot(mx, mz)
  // Normalise so diagonals are never faster than straight movement.
  if (ml > 1) {
    mx /= ml
    mz /= ml
  }
  const hasInput = ml > 0.01

  // Smooth acceleration / deceleration toward the target velocity. A climb
  // counts as ground contact so speed control does not change mid-step.
  const onFloor = s.grounded || s.stepActive
  const topSpeed = input.sprint ? MOVE.sprintSpeed : MOVE.walkSpeed
  const rate = onFloor
    ? hasInput
      ? MOVE.groundAccel
      : MOVE.groundDecel
    : hasInput
      ? MOVE.airAccel
      : MOVE.airDecel
  const maxDelta = rate * dt
  s.hvx = approach(s.hvx, mx * topSpeed, maxDelta)
  s.hvz = approach(s.hvz, mz * topSpeed, maxDelta)

  // Jump: buffered press + coyote time, only from the ground. One jump per press.
  if (input.jumpQueued) {
    s.jumpBuffer = MOVE.jumpBuffer
    input.jumpQueued = false
  } else {
    s.jumpBuffer = Math.max(0, s.jumpBuffer - dt)
  }
  s.coyote = s.grounded ? MOVE.coyoteTime : Math.max(0, s.coyote - dt)

  let vy = Math.max(lv.y, -MOVE.terminalVelocity)
  let jumped = false
  if (s.jumpBuffer > 0 && s.coyote > 0) {
    vy = MOVE.jumpSpeed
    s.airLock = MOVE.jumpAirLock
    s.jumpBuffer = 0
    s.coyote = 0
    s.grounded = false
    s.stepActive = false
    jumped = true
  }

  const t = body.translation()
  if (t.y < KILL_PLANE_Y) {
    // Fell out of the world: respawn.
    const [sx, sy, sz] = SPAWN_POSITION
    body.setTranslation({ x: sx, y: sy, z: sz }, true)
    body.setLinvel({ x: 0, y: 0, z: 0 }, true)
    s.hvx = 0
    s.hvz = 0
    s.grounded = false
    s.stepActive = false
    s.stepFinishing = false
    return
  }

  // Step-up.
  const feetY = t.y - FEET_OFFSET
  let climbing = false
  if (s.stepActive) {
    const remaining = s.stepTarget - feetY
    s.stepStall = feetY - s.stepLastFeet < STEP.minProgress ? s.stepStall + 1 : 0
    s.stepLastFeet = feetY
    s.stepLeft -= 1
    if (!hasInput || remaining <= STEP.tolerance || s.stepLeft <= 0 || s.stepStall >= STEP.maxStall) {
      s.stepActive = false
      s.stepFinishing = true
    } else {
      climbing = true
      // Gravity is added by the integrator, so compensate to lift at the planned speed.
      vy = Math.min(remaining / dt, STEP.climbSpeed) + MOVE.gravity * dt
    }
  } else if (!jumped && s.grounded && hasInput && groundGap <= STEP.maxGroundGap) {
    const speed = Math.hypot(s.hvx, s.hvz)
    if (speed > STEP.minSpeed) {
      const result = detectStep(probe, body, s.hvx / speed, s.hvz / speed, speed)
      if (result.target !== null) {
        s.stepActive = true
        s.stepTarget = result.target
        s.stepLeft = STEP.maxSteps
        s.stepStall = 0
        s.stepLastFeet = feetY
        climbing = true
        vy = Math.min((result.target - feetY) / dt, STEP.climbSpeed) + MOVE.gravity * dt
      } else if (result.wall) {
        // Too tall to climb, yet low enough for the rounded capsule to roll up
        // on its own: stop pushing into it (sliding along it is still allowed).
        const into = s.hvx * result.nx + s.hvz * result.nz
        if (into < 0) {
          s.hvx -= into * result.nx
          s.hvz -= into * result.nz
        }
      }
    }
  }
  if (!climbing && s.stepFinishing) {
    vy = Math.min(vy, 0)
    s.stepFinishing = false
  }

  // Ceiling: never plan to rise further than the space above the head.
  if (vy > 0) {
    const room = probeCeiling(probe, body, vy * dt)
    if (vy * dt > room - CEILING.skin) vy = Math.max(0, (room - CEILING.skin) / dt)
  } else if (vy < 0 && Number.isFinite(groundGap)) {
    // Landing: never plan to descend further than the space below the feet.
    const room = Math.max(0, groundGap - LANDING.skin)
    if (-vy * dt > room) vy = -room / dt
  }

  // Standing still on the ground: hold position instead of creeping down slopes.
  const resting =
    s.grounded &&
    groundGap <= GROUND_PROBE.restGap &&
    !hasInput &&
    Math.hypot(s.hvx, s.hvz) < 0.05 &&
    vy <= 0.5
  if (resting) vy = 0
  body.setGravityScale(resting ? 0 : GRAVITY_SCALE, true)
  body.setLinvel({ x: s.hvx, y: vy, z: s.hvz }, true)

  // Publish for animation and facing. Speed is what the solver actually
  // achieved last step, so it drops to ~0 when pressed against a wall. A
  // step-up is shown as walking, not as a jump.
  playerState.speed = Math.hypot(lv.x, lv.z)
  playerState.verticalVelocity = climbing ? 0 : vy
  playerState.grounded = s.grounded || climbing
  const hl = Math.hypot(s.hvx, s.hvz)
  if (hl > 0.5) {
    playerState.heading.x = s.hvx / hl
    playerState.heading.z = s.hvz / hl
  }
}
