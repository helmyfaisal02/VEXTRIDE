import { memo, useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import { Vector3 } from 'three'
import { playerState } from '../character'
import { damp } from '../shared/math'
import { MAX_FRAME_DT, poseCamera } from './cameraTransition'
import { cameraRig, FOLLOW } from './cameraRig'
import { useCameraInput } from './useCameraInput'

interface CameraState {
  initialised: boolean
  distance: number
  focus: Vector3
  target: Vector3
  offset: Vector3
  position: Vector3
  ray: InstanceType<ReturnType<typeof useRapier>['rapier']['Ray']>
}

const FOCUS_RATE = 16
const PULL_IN_RATE = 28
const PUSH_OUT_RATE = 5

/**
 * Third-person follow camera. Orbits the player using `cameraRig` (mouse drag
 * and wheel), follows with light smoothing, and pulls in when a collider sits
 * between the player and the desired camera position. Must be mounted inside
 * <Physics> so it can ray-cast against the world.
 */
function ThirdPersonCameraImpl() {
  const { world, rapier } = useRapier()
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
    ray: new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }),
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
    const { focus, target, offset, position, ray } = s
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

    // Unit vector from the focus toward the camera.
    const cp = Math.cos(cameraRig.pitch)
    offset.set(Math.sin(cameraRig.yaw) * cp, Math.sin(cameraRig.pitch), Math.cos(cameraRig.yaw) * cp)

    // Pull the camera in front of static geometry. Dynamic bodies (the player
    // and the crates) are ignored so they never make the camera jump.
    ray.origin.x = focus.x
    ray.origin.y = focus.y
    ray.origin.z = focus.z
    ray.dir.x = offset.x
    ray.dir.y = offset.y
    ray.dir.z = offset.z
    const flags =
      rapier.QueryFilterFlags.EXCLUDE_DYNAMIC |
      rapier.QueryFilterFlags.EXCLUDE_KINEMATIC |
      rapier.QueryFilterFlags.EXCLUDE_SENSORS
    const hit = world.castRay(ray, cameraRig.distance + FOLLOW.collisionMargin, true, flags)
    const allowed = hit
      ? Math.max(FOLLOW.minCollisionDistance, hit.timeOfImpact - FOLLOW.collisionMargin)
      : cameraRig.distance
    const wanted = Math.min(allowed, cameraRig.distance)
    s.distance = damp(s.distance, wanted, wanted < s.distance ? PULL_IN_RATE : PUSH_OUT_RATE, dt)

    position.copy(focus).addScaledVector(offset, s.distance)
    if (position.y < FOLLOW.minHeight) position.y = FOLLOW.minHeight
    // Blends in from whichever camera was active before (see cameraTransition).
    poseCamera(camera, position, focus, dt)
  })

  return null
}

export const ThirdPersonCamera = memo(ThirdPersonCameraImpl)
