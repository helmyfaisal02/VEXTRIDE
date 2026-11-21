import type { useRapier, RapierRigidBody } from '@react-three/rapier'
import { CAPSULE_HALF_SEGMENT, CAPSULE_RADIUS, FEET_OFFSET } from '../character/config'
import { GROUND_SIZE } from '../shared/constants'
import { inputState } from '../input/inputState'
import { COUPE, type VehicleDefinition } from './vehicleConfig'
import { bodyYaw } from './vehicleSim'
import { useVehicleStore, vehicleRuntime, vehicleRegistry } from './vehicleState'

type Physics = Pick<ReturnType<typeof useRapier>, 'world' | 'rapier'>
const IDENTITY = { x: 0, y: 0, z: 0, w: 1 }
const BRAKE_HINT = 'Brake to stop before exiting'

export function canEnter(physics: Physics, car: RapierRigidBody, player: RapierRigidBody, definition: VehicleDefinition = COUPE): boolean {
  const p = player.translation(), v = car.translation()
  return canEnterAt(physics, car, player, definition, p, v, Math.hypot(v.x - p.x, v.z - p.z))
}

function canEnterAt(
  physics: Physics, car: RapierRigidBody, player: RapierRigidBody, definition: VehicleDefinition,
  p: ReturnType<RapierRigidBody['translation']>, v: ReturnType<RapierRigidBody['translation']>, distance: number,
): boolean {
  if (distance > definition.entryRange || Math.abs(p.y - v.y) > 2) return false
  const velocity = car.linvel()
  if (Math.hypot(velocity.x, velocity.z) > definition.exitSpeed) return false
  if (distance < 0.01) return true
  return !physics.world.castRay(new physics.rapier.Ray(
    { x: p.x, y: p.y + 0.4, z: p.z },
    { x: (v.x - p.x) / distance, y: 0, z: (v.z - p.z) / distance },
  ), distance, true, physics.rapier.QueryFilterFlags.EXCLUDE_SENSORS, undefined, undefined, player, collider => collider.parent()?.handle !== car.handle)
}

/** Real ground normal, capsule clearance, and an unobstructed path out; no guessed surface Y. */
export function findVehicleExit(physics: Physics, car: RapierRigidBody, player: RapierRigidBody, definition: VehicleDefinition = COUPE, removing = false) {
  const p = car.translation(), yaw = bodyYaw(car), c = Math.cos(yaw), s = Math.sin(yaw)
  const capsule = new physics.rapier.Capsule(CAPSULE_HALF_SEGMENT, CAPSULE_RADIUS)
  const side = definition.width/2+.8, end = definition.length/2+.9, rear = 1.2*definition.wheelbase/COUPE.wheelbase
  const candidates=[[-side, 0], [side, 0], [0, end], [0, -end], [-side, rear], [side, rear]]
  if(removing)candidates.push([0,0]) // The disappearing chassis may free the only capsule-sized space.
  for (const [x, z] of candidates) {
    const wx = p.x + c * x + s * z, wz = p.z - s * x + c * z
    if (Math.abs(wx) > GROUND_SIZE / 2 - 0.5 || Math.abs(wz) > GROUND_SIZE / 2 - 0.5) continue
    const hit = physics.world.castRayAndGetNormal(new physics.rapier.Ray({ x: wx, y: p.y + 1.5, z: wz }, { x: 0, y: -1, z: 0 }), 3.5, true, physics.rapier.QueryFilterFlags.EXCLUDE_DYNAMIC | physics.rapier.QueryFilterFlags.EXCLUDE_SENSORS)
    if (!hit || hit.normal.y < 0.7) continue
    const ground = p.y + 1.5 - hit.timeOfImpact
    if (Math.abs(ground - (p.y - definition.rideHeight)) > 0.45) continue
    const candidate = { x: wx, y: ground + FEET_OFFSET + 0.04, z: wz }
    if (physics.world.intersectionWithShape(candidate, IDENTITY, capsule, physics.rapier.QueryFilterFlags.EXCLUDE_SENSORS, undefined, undefined, player, collider => !removing || collider.parent()?.handle !== car.handle)) continue
    const length = Math.hypot(wx - p.x, wz - p.z)
    if(removing&&length<.01)return candidate
    const blocked = physics.world.castRay(new physics.rapier.Ray({ x: p.x, y: p.y + 0.5, z: p.z }, { x: (wx - p.x) / length, y: 0, z: (wz - p.z) / length }), length, true, physics.rapier.QueryFilterFlags.EXCLUDE_SENSORS, undefined, undefined, car)
    if (!blocked) return candidate
  }
  return null
}

/** Nearest valid body wins; ties retain deterministic definition order. */
export function nearestVehicle(physics: Physics, player: RapierRigidBody) {
  let nearest: ReturnType<typeof vehicleRegistry.get> = undefined
  let distance = Infinity
  const p=player.translation()
  for(const entry of vehicleRegistry.values()) {
    const car = entry.body
    if (!car?.isValid()) continue
    const v = car.translation(), d = Math.hypot(p.x - v.x, p.z - v.z)
    if (d < distance && canEnterAt(physics, car, player, entry.definition, p, v, d)) {
      nearest = entry
      distance = d
    }
  }
  return nearest
}

/** One coordinator consumes E once, independently of how many cars are rendered. */
export function processVehicleInteraction(
  physics: Physics, walkingSelection?: NonNullable<ReturnType<typeof nearestVehicle>> | null,
): void {
  const player=vehicleRuntime.pedestrian
  if(!player)return
  const store=useVehicleStore.getState()
  // The coordinator already checked range, speed and occlusion this step.
  // Null means it found no eligible car. Standalone callers can omit the result.
  const selected = store.driving && store.activeVehicleId ? vehicleRegistry.get(store.activeVehicleId)
    : walkingSelection === undefined ? nearestVehicle(physics, player) : walkingSelection
  const car=selected?.body, definition=selected?.definition
  if(!inputState.interactQueued){
    if(!store.driving)store.setHint(selected ? `E — Enter ${selected.definition.name}` : '')
    else if(car && definition && store.hint===BRAKE_HINT && Math.hypot(car.linvel().x,car.linvel().z)<=definition.exitSpeed)store.setHint('')
    return
  }
  inputState.interactQueued=false
  if(!car || !definition)return
  const velocity=car.linvel()
  if(!store.driving){
    player.setLinvel({x:0,y:0,z:0},true)
    player.setEnabled(false)
    car.wakeUp()
    store.setDriving(true,definition.id)
  }else{
    if(Math.hypot(velocity.x,velocity.z)>definition.exitSpeed){store.setHint(BRAKE_HINT);return}
    const exit=findVehicleExit(physics,car,player,definition)
    if(!exit){store.setHint('Exit blocked — move to a clear, level space');return}
    car.setLinvel({x:0,y:velocity.y,z:0},true)
    car.setAngvel({x:0,y:0,z:0},true)
    player.setTranslation(exit,true)
    player.setLinvel({x:0,y:0,z:0},true)
    player.setEnabled(true)
    store.setDriving(false)
  }
}
