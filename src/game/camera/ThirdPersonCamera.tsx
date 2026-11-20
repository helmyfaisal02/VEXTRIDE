import { memo, useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import { Vector3 } from 'three'
import { playerState } from '../character'
import { MAX_FRAME_DT, poseCamera } from './cameraTransition'
import { cameraRig, FOLLOW } from './cameraRig'
import { useCameraInput } from './useCameraInput'
import { CAMERA_PROBE_RADIUS, cameraClearance, stepCameraDistance } from './cameraCollision'

interface CameraState {
  initialised: boolean
  distance: number
  focus: Vector3
  target: Vector3
  offset: Vector3
  position: Vector3
  probeDirection: Vector3
  probe: InstanceType<ReturnType<typeof useRapier>['rapier']['Ball']>
}

const FOCUS_RATE = 16

/**
 * Third-person follow camera. Orbits the player using `cameraRig` (mouse drag
 * and wheel), follows with light smoothing, and pulls in when a collider sits
 * between the player and the desired camera position. Must be mounted inside
 * <Physics> so it can sweep its camera volume against the world.
 */
function ThirdPersonCameraImpl() {
  const physics = useRapier()
  const { rapier } = physics
  useCameraInput()

  // Scratch state lives in a ref so the frame loop can mutate it freely.
  const state = useRef<CameraState | null>(null)
  state.current ??= {
    initialised: false,
    distance: FOLLOW.defaultDistance,
    focus: new Vector3(),
    target: new Vector3(),
    offset: new Vector3(),
    position: new Vector3(),
    probeDirection: new Vector3(),
    probe: new rapier.Ball(CAMERA_PROBE_RADIUS),
  }

  useEffect(() => {
    const s = state.current
    if (s) s.initialised = false
    return () => {
      if (s) s.initialised = false
    }
  }, [])

  useFrame(({ camera }, delta) => {
    const s = state.current
    if (!s) return
    const { focus, target, offset, position, probe, probeDirection } = s
    const dt = Math.min(delta, MAX_FRAME_DT)

    target.copy(playerState.position)
    target.y += FOLLOW.lookHeight
    if (!s.initialised) {
      focus.copy(target)
      s.distance = cameraRig.distance
      s.initialised = true
    } else {
      const k = 1 - Math.exp(-FOCUS_RATE * dt)
      focus.lerp(target, k)
    }
    // Near a corner the smoothed focus must not lag through the building.
    probeDirection.copy(focus).sub(target)
    const lag = probeDirection.length()
    if (lag > 1e-6) {
      probeDirection.divideScalar(lag)
      const clearLag = cameraClearance(physics, target, probeDirection, lag, probe)
      if (clearLag < lag) focus.copy(target).addScaledVector(probeDirection, clearLag)
    }

    // Unit vector from the focus toward the camera.
    const cp = Math.cos(cameraRig.pitch)
    offset.set(Math.sin(cameraRig.yaw) * cp, Math.sin(cameraRig.pitch), Math.cos(cameraRig.yaw) * cp)

    const allowed = cameraClearance(physics, focus, offset, cameraRig.distance, probe)
    s.distance = stepCameraDistance(s.distance, allowed, dt)

    position.copy(focus).addScaledVector(offset, s.distance)
    if (position.y < FOLLOW.minHeight) position.y = FOLLOW.minHeight
    // Blends in from whichever camera was active before (see cameraTransition).
    poseCamera(camera, position, focus, dt)
    // The hand-over blend can also cross a wall. Constrain the rendered pose,
    // without restarting its easing or changing the creator/orbit cameras.
    probeDirection.copy(camera.position).sub(focus)
    const blendedDistance = probeDirection.length()
    if (blendedDistance > 1e-6) {
      probeDirection.divideScalar(blendedDistance)
      const clear = cameraClearance(physics, focus, probeDirection, blendedDistance, probe)
      if (clear < blendedDistance) camera.position.copy(focus).addScaledVector(probeDirection, clear)
    }
  })

  return null
}

export const ThirdPersonCamera = memo(ThirdPersonCameraImpl)
