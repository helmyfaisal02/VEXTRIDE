import { Vector3 } from 'three'

export type AnimState = 'idle' | 'walk' | 'run' | 'jump' | 'fall' | 'land'

/**
 * Live, mutable snapshot of the player, written by the character systems and
 * read by the camera and animation. Not React state: it changes every frame.
 */
export interface PlayerState {
  /** Interpolated capsule centre in world space (render-accurate). */
  position: Vector3
  /** Actual horizontal speed achieved last step (m/s), after collisions. */
  speed: number
  /** Vertical velocity (m/s). */
  verticalVelocity: number
  /** Desired horizontal velocity direction, used for facing. */
  heading: { x: number; z: number }
  grounded: boolean
  /** Yaw (radians) of the visible model; its front faces (sin, cos) of this angle. */
  facingYaw: number
  animState: AnimState
}

export const playerState: PlayerState = {
  position: new Vector3(),
  speed: 0,
  verticalVelocity: 0,
  heading: { x: 0, z: -1 },
  grounded: false,
  facingYaw: Math.PI,
  animState: 'idle',
}
