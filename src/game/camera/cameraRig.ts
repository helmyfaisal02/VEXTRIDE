/**
 * Player-controlled camera parameters, written by pointer input and read by
 * the follow camera each frame. Mutable and outside React on purpose.
 */
export const FOLLOW = {
  /** Height above the capsule centre that the camera looks at (about head height). */
  lookHeight: 0.7,
  defaultYaw: 0,
  defaultPitch: 0.3,
  defaultDistance: 6.5,
  minPitch: -0.2,
  maxPitch: 1.35,
  minDistance: 2.5,
  maxDistance: 14,
  /** Closest the collision pull-in may bring the camera to the player. */
  minCollisionDistance: 0.9,
  /** Gap kept between the camera and any surface it was pulled in front of. */
  collisionMargin: 0.3,
  /** Never let the camera dip below this world height. */
  minHeight: 0.35,
  rotateSensitivity: 0.0055,
  zoomSensitivity: 0.0012,
} as const

export interface CameraRig {
  /** Rotation around the player; 0 puts the camera on the +Z side. */
  yaw: number
  /** Elevation angle above the horizontal. */
  pitch: number
  /** Requested distance from the look target. */
  distance: number
}

export const cameraRig: CameraRig = {
  yaw: FOLLOW.defaultYaw,
  pitch: FOLLOW.defaultPitch,
  distance: FOLLOW.defaultDistance,
}

export function resetCameraRig(): void {
  cameraRig.yaw = FOLLOW.defaultYaw
  cameraRig.pitch = FOLLOW.defaultPitch
  cameraRig.distance = FOLLOW.defaultDistance
}
