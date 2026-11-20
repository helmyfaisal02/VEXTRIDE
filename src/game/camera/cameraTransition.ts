import { Quaternion, Vector3, type Camera, type PerspectiveCamera } from 'three'
import {
  CREATOR_PANEL_MARGIN,
  CREATOR_PANEL_WIDTH,
  NARROW_BREAKPOINT,
  SHEET_HEIGHT_FRACTION,
} from '../shared/layout'
import { damp } from '../shared/math'

/**
 * Camera hand-over between the preview, gameplay and debug cameras.
 *
 * Exactly one camera system is mounted at a time (see CameraDirector). When the
 * active one changes, the pose the camera had is captured here and every
 * following frame blends from it to the new system's desired pose over a fixed
 * time. Blending is by elapsed seconds, so it takes the same time at any frame rate.
 */

/** Seconds a hand-over takes. */
export const TRANSITION_DURATION = 0.9
/** Largest time step accepted per frame, so a stalled frame cannot skip the blend. */
export const MAX_FRAME_DT = 0.1

interface TransitionState {
  active: boolean
  elapsed: number
  fromPosition: Vector3
  fromQuaternion: Quaternion
}

const transition: TransitionState = {
  active: false,
  elapsed: 0,
  fromPosition: new Vector3(),
  fromQuaternion: new Quaternion(),
}
const desiredQuaternion = new Quaternion()

export function smootherstep(t: number): number {
  const x = Math.min(1, Math.max(0, t))
  return x * x * x * (x * (x * 6 - 15) + 10)
}

/** Remembers the camera's current pose; the next `poseCamera` calls blend away from it. */
export function beginCameraTransition(camera: Camera): void {
  transition.fromPosition.copy(camera.position)
  transition.fromQuaternion.copy(camera.quaternion)
  transition.elapsed = 0
  transition.active = true
}

export function isCameraTransitioning(): boolean {
  return transition.active
}

/** Progress of the current hand-over from 0 to 1 (1 when none is running). */
export function cameraTransitionProgress(): number {
  return transition.active ? Math.min(1, transition.elapsed / TRANSITION_DURATION) : 1
}

function isFiniteVector(v: Vector3): boolean {
  return Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z)
}

/**
 * Places the camera at `position` looking at `lookAt`, blended with the pose it
 * had when the hand-over began. Non-finite input leaves the camera untouched.
 */
export function poseCamera(camera: Camera, position: Vector3, lookAt: Vector3, dt: number): void {
  if (!isFiniteVector(position) || !isFiniteVector(lookAt) || !Number.isFinite(dt)) return

  camera.position.copy(position)
  camera.lookAt(lookAt)
  if (!transition.active) return

  transition.elapsed += Math.min(Math.max(dt, 0), MAX_FRAME_DT)
  const progress = transition.elapsed / TRANSITION_DURATION
  const k = smootherstep(progress)
  desiredQuaternion.copy(camera.quaternion)
  camera.position.lerpVectors(transition.fromPosition, position, k)
  camera.quaternion.copy(transition.fromQuaternion).slerp(desiredQuaternion, k)
  if (progress >= 1) transition.active = false
}

/**
 * Where an orbit camera should look so that entering it from another camera
 * does not turn the view: straight ahead of where the camera already points,
 * at roughly the player's distance.
 */
export function orbitTargetFromView(
  cameraPosition: Vector3,
  viewDirection: Vector3,
  playerPosition: Vector3,
  out: Vector3,
): Vector3 {
  const distance = Math.min(60, Math.max(6, cameraPosition.distanceTo(playerPosition)))
  return out.copy(viewDirection).normalize().multiplyScalar(distance).add(cameraPosition)
}

/* --------------------------- creator view offset ---------------------------- */

export interface ViewOffset {
  x: number
  y: number
}

/** Pixel shift that keeps the character in the part of the screen the creator leaves free. */
export function computeViewOffsetTarget(
  width: number,
  height: number,
  creatorOpen: boolean,
  out: ViewOffset,
): ViewOffset {
  if (!creatorOpen) {
    out.x = 0
    out.y = 0
  } else if (width < NARROW_BREAKPOINT) {
    out.x = 0
    out.y = height * (0.5 - (1 - SHEET_HEIGHT_FRACTION) / 2)
  } else {
    out.x = -(CREATOR_PANEL_WIDTH + CREATOR_PANEL_MARGIN) / 2
    out.y = 0
  }
  return out
}

const VIEW_OFFSET_RATE = 7

/** Eases the current offset toward the target. Frame-rate independent. */
export function stepViewOffset(current: ViewOffset, target: ViewOffset, dt: number): void {
  current.x = damp(current.x, target.x, VIEW_OFFSET_RATE, dt)
  current.y = damp(current.y, target.y, VIEW_OFFSET_RATE, dt)
  if (Math.abs(current.x - target.x) < 0.25) current.x = target.x
  if (Math.abs(current.y - target.y) < 0.25) current.y = target.y
}

/** Applies the offset to a perspective camera, or clears it when it is zero. */
export function applyViewOffset(camera: PerspectiveCamera, width: number, height: number, offset: ViewOffset): void {
  if (offset.x === 0 && offset.y === 0) {
    if (camera.view?.enabled) camera.clearViewOffset()
    return
  }
  camera.setViewOffset(width, height, offset.x, offset.y, width, height)
}
