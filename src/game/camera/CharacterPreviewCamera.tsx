import { memo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Vector3 } from 'three'
import { playerState } from '../character'
import { NARROW_BREAKPOINT } from '../shared/layout'
import { MAX_FRAME_DT, poseCamera } from './cameraTransition'
import type { CameraRig } from './cameraRig'
import { usePointerOrbit, type OrbitLimits } from './useCameraInput'

const LIMITS: OrbitLimits = {
  minPitch: -0.1,
  maxPitch: 0.6,
  minDistance: 2.2,
  maxDistance: 6,
  rotateSensitivity: 0.007,
  zoomSensitivity: 0.001,
}

const AUTO_ROTATE_SPEED = 0.45
/** Seconds of no interaction before the turntable resumes. */
const AUTO_ROTATE_DELAY = 2.5
const LOOK_RATE = 7

const previewRig: CameraRig = { yaw: 0, pitch: 0.1, distance: 3.3 }
const state = { lastInteract: -Infinity, initialised: false }
const look = new Vector3()
const desired = new Vector3()

function markInteract(): void {
  state.lastInteract = performance.now()
}

/**
 * Turntable camera used while the character creator is open. It orbits the
 * real player model (the same one that plays), so the preview is the actual
 * game geometry, lighting and shadows. Drag to rotate, wheel to zoom.
 */
function CharacterPreviewCameraImpl() {
  usePointerOrbit(previewRig, LIMITS, markInteract)

  useEffect(() => {
    // Start in front of the character's face.
    previewRig.yaw = playerState.facingYaw
    previewRig.pitch = 0.1
    previewRig.distance = window.innerWidth < NARROW_BREAKPOINT ? 4.6 : 3.3
    state.lastInteract = -Infinity
    state.initialised = false
  }, [])

  useFrame(({ camera }, delta) => {
    const dt = Math.min(delta, MAX_FRAME_DT)
    if ((performance.now() - state.lastInteract) / 1000 > AUTO_ROTATE_DELAY) {
      previewRig.yaw += AUTO_ROTATE_SPEED * dt
    }

    const cp = Math.cos(previewRig.pitch)
    desired
      .set(
        Math.sin(previewRig.yaw) * cp,
        Math.sin(previewRig.pitch),
        Math.cos(previewRig.yaw) * cp,
      )
      .multiplyScalar(previewRig.distance)
      .add(playerState.position)
    desired.y = Math.max(0.35, desired.y)

    if (!state.initialised) {
      look.copy(playerState.position)
      state.initialised = true
    }
    look.lerp(playerState.position, 1 - Math.exp(-LOOK_RATE * dt))
    // Blends in from whichever camera was active before (see cameraTransition).
    poseCamera(camera, desired, look, dt)
  })

  return null
}

export const CharacterPreviewCamera = memo(CharacterPreviewCameraImpl)
