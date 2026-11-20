import type { useRapier, RapierRigidBody } from '@react-three/rapier'
import { CAPSULE_HALF_SEGMENT, CAPSULE_RADIUS, FEET_OFFSET } from '../character/config'
import { GROUND_SIZE } from '../shared/constants'
import { inputState } from '../input/inputState'
import { COUPE } from './vehicleConfig'
import { bodyYaw } from './vehicleSim'
import { useVehicleStore, vehicleRuntime } from './vehicleState'

type Physics = Pick<ReturnType<typeof useRapier>, 'world' | 'rapier'>
const IDENTITY = { x: 0, y: 0, z: 0, w: 1 }
const BRAKE_HINT = 'Brake to stop before exiting'

export function canEnter(physics: Physics, car: RapierRigidBody, player: RapierRigidBody): boolean {
  const p = player.translation(), v = car.translation(), velocity = car.linvel()
  if (Math.hypot(p.x - v.x, p.z - v.z) > COUPE.entryRange || Math.abs(p.y - v.y) > 2 || Math.hypot(velocity.x, velocity.z) > COUPE.exitSpeed) return false
  const dx = v.x - p.x, dz = v.z - p.z, len = Math.hypot(dx, dz)
  if (len < 0.01) return true
  return !physics.world.castRay(new physics.rapier.Ray({ x: p.x, y: p.y + 0.4, z: p.z }, { x: dx / len, y: 0, z: dz / len }), len, true, physics.rapier.QueryFilterFlags.EXCLUDE_DYNAMIC | physics.rapier.QueryFilterFlags.EXCLUDE_SENSORS)
}

/** Real ground normal, capsule clearance, and an unobstructed path out; no guessed surface Y. */
export function findVehicleExit(physics: Physics, car: RapierRigidBody, player: RapierRigidBody) {
  const p = car.translation(), yaw = bodyYaw(car), c = Math.cos(yaw), s = Math.sin(yaw)
  const capsule = new physics.rapier.Capsule(CAPSULE_HALF_SEGMENT, CAPSULE_RADIUS)
  for (const [x, z] of [[-1.7, 0], [1.7, 0], [0, 3], [0, -3], [-1.7, 1.2], [1.7, 1.2]]) {
    const wx = p.x + c * x + s * z, wz = p.z - s * x + c * z
    if (Math.abs(wx) > GROUND_SIZE / 2 - 0.5 || Math.abs(wz) > GROUND_SIZE / 2 - 0.5) continue
    const hit = physics.world.castRayAndGetNormal(new physics.rapier.Ray({ x: wx, y: p.y + 1.5, z: wz }, { x: 0, y: -1, z: 0 }), 3.5, true, physics.rapier.QueryFilterFlags.EXCLUDE_DYNAMIC | physics.rapier.QueryFilterFlags.EXCLUDE_SENSORS)
    if (!hit || hit.normal.y < 0.7) continue
    const ground = p.y + 1.5 - hit.timeOfImpact
    if (Math.abs(ground - (p.y - 0.5)) > 0.45) continue
    const candidate = { x: wx, y: ground + FEET_OFFSET + 0.04, z: wz }
    if (physics.world.intersectionWithShape(candidate, IDENTITY, capsule, physics.rapier.QueryFilterFlags.EXCLUDE_SENSORS, undefined, undefined, player)) continue
    const length = Math.hypot(wx - p.x, wz - p.z)
    const blocked = physics.world.castRay(new physics.rapier.Ray({ x: p.x, y: p.y + 0.5, z: p.z }, { x: (wx - p.x) / length, y: 0, z: (wz - p.z) / length }), length, true, physics.rapier.QueryFilterFlags.EXCLUDE_SENSORS, undefined, undefined, car)
    if (!blocked) return candidate
  }
  return null
}

/** Called only by the vehicle's fixed-step controller; uses the shared E edge queue. */
export function processVehicleInteraction(physics: Physics): void {
  const car = vehicleRuntime.body, player = vehicleRuntime.pedestrian
  if (!car || !player) return
  const store = useVehicleStore.getState(), velocity = car.linvel()
  const ready = !store.driving && canEnter(physics, car, player)
  if (!inputState.interactQueued) {
    if (!store.driving) store.setHint(ready ? 'E — Enter VEXTRIDE Street Coupe' : '')
    else if (store.hint === BRAKE_HINT && Math.hypot(velocity.x, velocity.z) <= COUPE.exitSpeed) store.setHint('')
    return
  }
  inputState.interactQueued = false
  if (!store.driving) {
    if (!ready) return
    player.setLinvel({ x: 0, y: 0, z: 0 }, true)
    player.setEnabled(false)
    store.setDriving(true)
  } else {
    if (Math.hypot(velocity.x, velocity.z) > COUPE.exitSpeed) { store.setHint(BRAKE_HINT); return }
    const exit = findVehicleExit(physics, car, player)
    if (!exit) { store.setHint('Exit blocked — move to a clear, level space'); return }
    car.setLinvel({ x: 0, y: velocity.y, z: 0 }, true)
    car.setAngvel({ x: 0, y: 0, z: 0 }, true)
    player.setTranslation(exit, true)
    player.setLinvel({ x: 0, y: 0, z: 0 }, true)
    player.setEnabled(true)
    store.setDriving(false)
  }
}
