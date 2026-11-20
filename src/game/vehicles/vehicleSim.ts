import type { useRapier, RapierRigidBody } from '@react-three/rapier'
import type { InputState } from '../input/inputState'
import { COUPE, type VehicleDefinition } from './vehicleConfig'

type Physics = Pick<ReturnType<typeof useRapier>, 'world' | 'rapier'>
export function bodyYaw(body: RapierRigidBody): number {
  const q = body.rotation()
  return Math.atan2(2 * (q.w * q.y + q.x * q.z), 1 - 2 * (q.y * q.y + q.z * q.z))
}
const approach = (v: number, target: number, step: number) => v + Math.sign(target - v) * Math.min(Math.abs(target - v), step)

export function createVehicleSim(rapier: Physics['rapier']) {
  return { idleTime: 0, acceleration: 0, handbrake: 0, steering: 0, grounded: false, roll: 0, previous: null as { x: number; z: number } | null, ray: new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 }) }
}
export type VehicleSim = ReturnType<typeof createVehicleSim>

/** Called before the existing fixed 60 Hz Rapier step. Velocities, never pose teleports. */
export function stepVehicle(sim: VehicleSim, physics: Physics, body: RapierRigidBody, input: InputState, driving: boolean, dt: number, definition: VehicleDefinition = COUPE): void {
  if (!driving && body.isSleeping()) return
  const p = body.translation(), yaw = bodyYaw(body), c = Math.cos(yaw), s = Math.sin(yaw)
  const v = body.linvel(), forward = -s * v.x - c * v.z, lateral = c * v.x - s * v.z
  if (sim.previous) {
    const dx = p.x - sim.previous.x, dz = p.z - sim.previous.z
    // Wheel travel follows resolved displacement, not throttle, speed targets or wall pushing.
    if (Math.hypot(dx, dz) < 2) sim.roll -= (-s * dx - c * dz) / definition.wheelRadius
  }
  sim.previous = { x: p.x, z: p.z }
  let contacts = 0
  for (const x of [-definition.probeTrack, definition.probeTrack]) for (const z of [-definition.wheelbase/2, definition.wheelbase/2]) {
    sim.ray.origin.x = p.x + c * x + s * z
    sim.ray.origin.z = p.z - s * x + c * z
    sim.ray.origin.y = p.y + 0.1
    const hit = physics.world.castRayAndGetNormal(sim.ray, definition.rideHeight + .22, true, physics.rapier.QueryFilterFlags.EXCLUDE_DYNAMIC | physics.rapier.QueryFilterFlags.EXCLUDE_SENSORS)
    if (hit && hit.normal.y > 0.65) contacts++
  }
  sim.grounded = contacts > 0
  const steer = driving ? Number(input.left) - Number(input.right) : 0
  const ratio = Math.min(1, Math.abs(forward) / definition.maxSpeed)
  const angle = definition.steeringAngle * (1 - definition.steeringReduction * ratio * ratio)
  sim.steering += (steer * angle - sim.steering) * (1 - Math.exp(-definition.steeringResponse / (1 + .6 * ratio) * dt))
  sim.handbrake += (Number(driving && input.jumpHeld) - sim.handbrake) * (1 - Math.exp(-definition.gripResponse * dt))
  if (!sim.grounded) { body.setAngvel({ x: 0, y: 0, z: 0 }, true); return }
  const throttle = driving && !input.jumpHeld && input.forward !== input.backward
    ? input.forward ? definition.acceleration : -definition.reverseAcceleration : 0
  sim.acceleration = approach(sim.acceleration, throttle, definition.throttleResponse * dt)
  let speed = forward
  if (!driving || input.jumpHeld) speed = approach(speed, 0, (driving ? definition.handbrakeBrake : 10) * dt)
  else if (input.forward && input.backward) speed = approach(speed, 0, definition.brake * dt)
  else if (input.forward && !input.backward) speed = speed < -0.3 ? approach(speed, 0, definition.brake * dt) : Math.min(definition.maxSpeed, speed + Math.max(0, sim.acceleration) * dt)
  else if (input.backward && !input.forward) speed = speed > 0.3 ? approach(speed, 0, definition.brake * dt) : Math.max(-definition.reverseSpeed, speed + Math.min(0, sim.acceleration) * dt)
  else speed = approach(speed, 0, (definition.coast + forward * forward * 0.004) * dt)
  speed = Math.max(-definition.reverseSpeed, Math.min(definition.maxSpeed, speed))
  const grip = definition.traction + (definition.handbrakeTraction - definition.traction) * sim.handbrake
  const side = lateral * Math.exp(-grip * dt)
  // Contacts still lift the chassis over low curbs; trim excessive grounded
  // rise from the spherical runners rather than converting it into a launch.
  body.setLinvel({ x: -s * speed + c * side, y: Math.min(v.y, definition.maxGroundRise), z: -c * speed - s * side }, driving)
  const limit = definition.yawLimit * (1 + (definition.handbrakeYaw - 1) * sim.handbrake) / (1 + Math.abs(speed) * definition.highSpeedSteering)
  const turn = speed / definition.wheelbase * Math.tan(sim.steering)
  body.setAngvel({ x: 0, y: Math.max(-limit, Math.min(limit, turn)), z: 0 }, driving)
  sim.idleTime = !driving && Math.hypot(v.x,v.z)<.03 && Math.abs(v.y)<.03 ? sim.idleTime+dt : 0
  if (sim.idleTime>.75) body.sleep()
}
