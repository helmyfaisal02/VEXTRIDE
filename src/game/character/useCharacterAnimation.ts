import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { clamp01, damp, lerp } from '../shared/math'
import type { CharacterRig } from './characterRig'
import {
  blendPose,
  createPose,
  FALL_POSE,
  groundPose,
  JUMP_POSE,
  LAND_POSE,
  type Pose,
} from './characterPoses'
import { MOVE } from './config'
import { playerState } from './playerState'

const HIPS_BASE_Y = 0.95
/** Seconds the landing crouch is held after a hard enough impact. */
const LAND_TIME = 0.16
/** Minimum downward speed (m/s) that triggers the landing crouch. */
const LAND_MIN_IMPACT = 5

interface AnimMemory {
  phase: number
  time: number
  move: number
  run: number
  air: number
  jump: number
  land: number
  landTimer: number
  wasAirborne: boolean
  lastAirVy: number
  smoothSpeed: number
  ground: Pose
  air_: Pose
  mixed: Pose
  final: Pose
}

function set(group: Group | null, x: number, y = 0, z = 0): void {
  if (group) group.rotation.set(x, y, z)
}

function setY(group: Group | null, y: number): void {
  if (group) group.position.y = y
}

/**
 * Procedural animation: locomotion cycle, jump, fall and landing, blended with
 * frame-rate independent smoothing. Reads `playerState`, writes joint rotations
 * directly on the rig; nothing here touches React state.
 */
export function useCharacterAnimation(rig: CharacterRig): void {
  const mem = useRef<AnimMemory>({
    phase: 0,
    time: 0,
    move: 0,
    run: 0,
    air: 1,
    jump: 0,
    land: 0,
    landTimer: 0,
    wasAirborne: true,
    lastAirVy: 0,
    smoothSpeed: 0,
    ground: createPose(),
    air_: createPose(),
    mixed: createPose(),
    final: createPose(),
  })

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    const a = mem.current
    const { speed, grounded, verticalVelocity: vy } = playerState

    a.time += dt
    a.smoothSpeed = damp(a.smoothSpeed, speed, 16, dt)

    // Landing detection.
    if (!grounded) a.lastAirVy = vy
    if (grounded && a.wasAirborne && -a.lastAirVy > LAND_MIN_IMPACT) a.landTimer = LAND_TIME
    a.wasAirborne = !grounded
    a.landTimer = Math.max(0, a.landTimer - dt)

    // Blend weights, smoothed so state changes ease in and out.
    const moveTarget = clamp01(a.smoothSpeed / MOVE.walkSpeed)
    const runTarget = clamp01((a.smoothSpeed - MOVE.walkSpeed - 0.6) / (MOVE.sprintSpeed - MOVE.walkSpeed - 0.6))
    a.move = damp(a.move, moveTarget, 12, dt)
    a.run = damp(a.run, runTarget, 8, dt)
    a.air = damp(a.air, grounded ? 0 : 1, 16, dt)
    a.jump = damp(a.jump, vy > 0 ? 1 : 0, 10, dt)
    a.land = damp(a.land, a.landTimer > 0 ? 1 : 0, 20, dt)

    // Gait phase advances with distance travelled, so feet match the ground speed.
    if (grounded) {
      const cycleLength = lerp(1.7, 3.0, a.run)
      a.phase = (a.phase + ((Math.PI * 2 * a.smoothSpeed) / cycleLength) * dt) % (Math.PI * 2)
    }

    groundPose(a.ground, a.phase, a.move, a.run, a.time)
    blendPose(a.air_, FALL_POSE, JUMP_POSE, a.jump)
    blendPose(a.mixed, a.ground, a.air_, a.air)
    const p = blendPose(a.final, a.mixed, LAND_POSE, a.land)

    set(rig.legL.current, p.legL)
    set(rig.legR.current, p.legR)
    set(rig.kneeL.current, p.kneeL)
    set(rig.kneeR.current, p.kneeR)
    set(rig.armL.current, p.armL, 0, p.armOut)
    set(rig.armR.current, p.armR, 0, -p.armOut)
    set(rig.elbowL.current, p.elbow)
    set(rig.elbowR.current, p.elbow)
    set(rig.torso.current, p.torsoX, p.torsoY)
    set(rig.head.current, p.headX, p.headY)
    setY(rig.hips.current, HIPS_BASE_Y + p.hipsY)

    // Exposed for later systems (audio, effects); the thresholds are only labels.
    playerState.animState =
      a.land > 0.5
        ? 'land'
        : !grounded
          ? vy > 0
            ? 'jump'
            : 'fall'
          : a.smoothSpeed < 0.4
            ? 'idle'
            : a.smoothSpeed < (MOVE.walkSpeed + MOVE.sprintSpeed) / 2
              ? 'walk'
              : 'run'
  })
}
