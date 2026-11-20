import type { useRapier, RapierRigidBody } from '@react-three/rapier'
import type { InputState } from '../input/inputState'
import { COUPE } from './vehicleConfig'

type Physics = Pick<ReturnType<typeof useRapier>, 'world' | 'rapier'>
export function bodyYaw(body: RapierRigidBody): number {
  const q = body.rotation()
  return Math.atan2(2 * (q.w * q.y + q.x * q.z), 1 - 2 * (q.y * q.y + q.z * q.z))
}
const approach = (v: number, target: number, step: number) => v + Math.sign(target - v) * Math.min(Math.abs(target - v), step)

export function createVehicleSim(rapier: Physics['rapier']) {
  return { steering: 0, grounded: false, roll: 0, previous: null as { x: number; z: number } | null, ray: new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 }) }
}
export type VehicleSim = ReturnType<typeof createVehicleSim>

/** Called before the existing fixed 60 Hz Rapier step. Velocities, never pose teleports. */
export function stepVehicle(sim: VehicleSim, physics: Physics, body: RapierRigidBody, input: InputState, driving: boolean, dt: number): void {
  const p = body.translation(), yaw = bodyYaw(body), c = Math.cos(yaw), s = Math.sin(yaw)
  const v = body.linvel(), forward = -s * v.x - c * v.z, lateral = c * v.x - s * v.z
  if (sim.previous) {
    const dx = p.x - sim.previous.x, dz = p.z - sim.previous.z
    // Wheel travel follows resolved displacement, not throttle, speed targets or wall pushing.
    if (Math.hypot(dx, dz) < 2) sim.roll -= (-s * dx - c * dz) / COUPE.wheelRadius
  }
  sim.previous = { x: p.x, z: p.z }
  let contacts = 0
  for (const x of [-0.64, 0.64]) for (const z of [-1.32, 1.32]) {
    sim.ray.origin.x = p.x + c * x + s * z
    sim.ray.origin.z = p.z - s * x + c * z
    sim.ray.origin.y = p.y + 0.1
    const hit = physics.world.castRayAndGetNormal(sim.ray, 0.72, true, physics.rapier.QueryFilterFlags.EXCLUDE_DYNAMIC | physics.rapier.QueryFilterFlags.EXCLUDE_SENSORS)
    if (hit && hit.normal.y > 0.65) contacts++
  }
  sim.grounded = contacts > 0
  const steer = driving ? Number(input.left) - Number(input.right) : 0
  sim.steering += (steer * 0.55 - sim.steering) * (1 - Math.exp(-9 * dt))
  if (!sim.grounded) { body.setAngvel({ x: 0, y: 0, z: 0 }, true); return }
  let speed = forward
  if (!driving || input.jumpHeld) speed = approach(speed, 0, (driving ? 12 : 10) * dt)
  else if (input.forward && !input.backward) speed = speed < -0.3 ? approach(speed, 0, COUPE.brake * dt) : Math.min(COUPE.maxSpeed, speed + COUPE.acceleration * dt)
  else if (input.backward && !input.forward) speed = speed > 0.3 ? approach(speed, 0, COUPE.brake * dt) : Math.max(-COUPE.reverseSpeed, speed - COUPE.reverseAcceleration * dt)
  else speed = approach(speed, 0, (COUPE.coast + forward * forward * 0.004) * dt)
  speed = Math.max(-COUPE.reverseSpeed, Math.min(COUPE.maxSpeed, speed))
  const side = lateral * Math.exp(-(input.jumpHeld && driving ? 5 : 16) * dt)
  // Contacts still lift the chassis over low curbs; trim excessive grounded
  // rise from the spherical runners rather than converting it into a launch.
  body.setLinvel({ x: -s * speed + c * side, y: Math.min(v.y, 1.2), z: -c * speed - s * side }, true)
  const limit = 1.35 / (1 + Math.abs(speed) * 0.04)
  const turn = speed / COUPE.wheelbase * Math.tan(sim.steering)
  body.setAngvel({ x: 0, y: Math.max(-limit, Math.min(limit, turn)), z: 0 }, true)
}
