import { lerp } from '../shared/math'

/** Joint angles (radians) plus a vertical hip offset. Rotations are about X unless noted. */
export interface Pose {
  legL: number
  legR: number
  kneeL: number
  kneeR: number
  armL: number
  armR: number
  /** Outward swing of the arms about Z (left arm positive, right arm mirrored). */
  armOut: number
  elbow: number
  torsoX: number
  torsoY: number
  headX: number
  headY: number
  hipsY: number
}

export function createPose(): Pose {
  return {
    legL: 0,
    legR: 0,
    kneeL: 0,
    kneeR: 0,
    armL: 0,
    armR: 0,
    armOut: 0,
    elbow: 0,
    torsoX: 0,
    torsoY: 0,
    headX: 0,
    headY: 0,
    hipsY: 0,
  }
}

export function blendPose(out: Pose, a: Pose, b: Pose, t: number): Pose {
  out.legL = lerp(a.legL, b.legL, t)
  out.legR = lerp(a.legR, b.legR, t)
  out.kneeL = lerp(a.kneeL, b.kneeL, t)
  out.kneeR = lerp(a.kneeR, b.kneeR, t)
  out.armL = lerp(a.armL, b.armL, t)
  out.armR = lerp(a.armR, b.armR, t)
  out.armOut = lerp(a.armOut, b.armOut, t)
  out.elbow = lerp(a.elbow, b.elbow, t)
  out.torsoX = lerp(a.torsoX, b.torsoX, t)
  out.torsoY = lerp(a.torsoY, b.torsoY, t)
  out.headX = lerp(a.headX, b.headX, t)
  out.headY = lerp(a.headY, b.headY, t)
  out.hipsY = lerp(a.hipsY, b.hipsY, t)
  return out
}

/**
 * Locomotion pose: idle breathing blended into a walk/run cycle.
 * With the model facing +Z, a negative X rotation swings a hanging limb forward.
 *
 * @param phase gait phase in radians
 * @param move  0 (standing) to 1 (walking pace or faster)
 * @param run   0 (walk) to 1 (sprint)
 * @param time  clock in seconds, for idle breathing
 */
export function groundPose(out: Pose, phase: number, move: number, run: number, time: number): Pose {
  const s = Math.sin(phase)
  const c = Math.cos(phase)
  const swing = lerp(0.55, 0.95, run) * move
  const kneeAmp = lerp(0.55, 1.5, run) * move
  const armSwing = lerp(0.5, 1.05, run) * move
  const idle = 1 - move
  const breathe = Math.sin(time * 1.8)

  out.legL = -s * swing
  out.legR = s * swing
  out.kneeL = Math.max(0, c) * kneeAmp
  out.kneeR = Math.max(0, -c) * kneeAmp
  out.armL = s * armSwing
  out.armR = -s * armSwing
  out.armOut = 0.07 + 0.015 * breathe * idle
  out.elbow = -(0.12 + (0.25 + 0.9 * run) * move)
  out.torsoX = (0.03 + 0.2 * run) * move + 0.012 * breathe * idle
  out.torsoY = s * 0.12 * move
  out.headX = -out.torsoX * 0.5 + 0.01 * breathe * idle
  out.headY = -out.torsoY * 0.6
  out.hipsY = Math.abs(c) * lerp(0.03, 0.06, run) * move
  return out
}

/** Rising: lead knee up, arms thrown up and forward. */
export const JUMP_POSE: Pose = {
  legL: -0.75,
  legR: 0.25,
  kneeL: 1.15,
  kneeR: 0.5,
  armL: -2.4,
  armR: -2.0,
  armOut: 0.3,
  elbow: -0.35,
  torsoX: 0.05,
  torsoY: 0,
  headX: -0.1,
  headY: 0,
  hipsY: 0,
}

/** Descending: legs reach down, arms spread for balance. */
export const FALL_POSE: Pose = {
  legL: -0.35,
  legR: 0.15,
  kneeL: 0.5,
  kneeR: 0.3,
  armL: -0.25,
  armR: -0.25,
  armOut: 1.25,
  elbow: -0.3,
  torsoX: 0.1,
  torsoY: 0,
  headX: -0.05,
  headY: 0,
  hipsY: 0,
}

/** Impact absorption: deep knee bend, torso folded forward. */
export const LAND_POSE: Pose = {
  legL: -0.75,
  legR: -0.75,
  kneeL: 1.4,
  kneeR: 1.4,
  armL: -0.5,
  armR: -0.5,
  armOut: 0.35,
  elbow: -0.6,
  torsoX: 0.4,
  torsoY: 0,
  headX: -0.2,
  headY: 0,
  hipsY: -0.2,
}
