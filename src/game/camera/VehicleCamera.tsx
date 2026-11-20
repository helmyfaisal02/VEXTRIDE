import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import { Vector3 } from 'three'
import { dampAngle } from '../shared/math'
import { vehicleState, getActiveVehicleDefinition } from '../vehicles/vehicleState'
import { CAMERA_PROBE_RADIUS, cameraClearance, stepCameraDistance } from './cameraCollision'
import { MAX_FRAME_DT, poseCamera } from './cameraTransition'
import { usePointerOrbit } from './useCameraInput'

export const vehicleCameraRig = { yaw: 0, pitch: .3, distance: 8 }
const LIMITS = { minPitch: .08, maxPitch: 1.1, minDistance: 4, maxDistance: 14, rotateSensitivity: .004, zoomSensitivity: .0012 }

/** Vehicle-relative orbit with a damped heading and the existing collision/hand-over utilities. */
export function VehicleCamera() {
  const physics = useRapier()
  usePointerOrbit(vehicleCameraRig, LIMITS)
  const state = useRef({ initialized: false, vehicleId: '', heading: 0, distance: 8, focus: new Vector3(), base: new Vector3(), offset: new Vector3(), direction: new Vector3(), position: new Vector3(), probe: new physics.rapier.Ball(CAMERA_PROBE_RADIUS) })
  useFrame(({ camera }, delta) => {
    const s = state.current, dt = Math.min(delta, MAX_FRAME_DT)
    const definition=getActiveVehicleDefinition()
    if(s.vehicleId!==definition.id){s.initialized=false;s.vehicleId=definition.id}
    s.base.copy(vehicleState.position); s.base.y += definition.camera.focusHeight
    if (!s.initialized) { s.heading = vehicleState.yaw; s.focus.copy(s.base); s.initialized = true }
    s.heading = dampAngle(s.heading, vehicleState.yaw, 6, dt)
    s.position.copy(s.base).addScaledVector(s.offset.set(-Math.sin(s.heading), 0, -Math.cos(s.heading)), Math.max(-.3, Math.min(.65, vehicleState.speed * .03)))
    s.focus.lerp(s.position, 1 - Math.exp(-12 * dt))
    s.direction.copy(s.focus).sub(s.base)
    const lag = s.direction.length()
    if (lag > 1e-6) {
      s.direction.divideScalar(lag)
      const allowed = cameraClearance(physics, s.base, s.direction, lag, s.probe)
      if (allowed < lag) s.focus.copy(s.base).addScaledVector(s.direction, allowed)
    }
    const pitch=vehicleCameraRig.pitch+definition.camera.pitch-.3
    const yaw = s.heading + vehicleCameraRig.yaw, cp = Math.cos(pitch)
    s.offset.set(Math.sin(yaw) * cp, Math.sin(pitch), Math.cos(yaw) * cp)
    const wanted = vehicleCameraRig.distance * definition.camera.distance / 8 + Math.min(1.5, Math.abs(vehicleState.speed) * .07)
    const allowed = cameraClearance(physics, s.focus, s.offset, wanted, s.probe)
    s.distance = stepCameraDistance(s.distance, allowed, dt)
    s.position.copy(s.focus).addScaledVector(s.offset, s.distance)
    poseCamera(camera, s.position, s.focus, dt)
    s.direction.copy(camera.position).sub(s.focus)
    const length = s.direction.length()
    if (length > 1e-6) {
      s.direction.divideScalar(length)
      const safe = cameraClearance(physics, s.focus, s.direction, length, s.probe)
      if (safe < length) camera.position.copy(s.focus).addScaledVector(s.direction, safe)
    }
  })
  return null
}
