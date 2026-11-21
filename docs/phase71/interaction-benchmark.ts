import RAPIER from '@dimforge/rapier3d-compat'
import { fleetFixture } from '../../scripts/vehicle-fleet-fixture'
import { processInteraction } from '../../src/game/interactions/interactionCoordinator'
import { vehicleRuntime } from '../../src/game/vehicles/vehicleState'
import { useCharacterStore } from '../../src/game/state/characterStore'
await RAPIER.init()
useCharacterStore.getState().setName('Bench')
useCharacterStore.getState().confirm()
const fixture=fleetFixture(true)
const car=fixture.entry('street-coupe').body
const p=car.translation()
const user=fixture.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(p.x-1.8,p.y+.4,p.z))
fixture.world.createCollider(RAPIER.ColliderDesc.capsule(.35,.28),user)
fixture.world.step()
vehicleRuntime.pedestrian=user
const metrics={}
let calls=0
const original=fixture.world.castRay.bind(fixture.world)
fixture.world.castRay=(...args)=>{calls++;return original(...args)}
processInteraction(fixture.physics)
metrics.nearbyRaysPerStep=calls
fixture.world.castRay=original
for(const scene of ['nearby','remote']){
 if(scene==='remote'){user.setTranslation({x:0,y:1,z:0},true);fixture.world.step()}
 for(let i=0;i<10000;i++)processInteraction(fixture.physics)
 const runs=[]
 for(let r=0;r<7;r++){
  const t=performance.now()
  for(let i=0;i<50000;i++)processInteraction(fixture.physics)
  runs.push(performance.now()-t)
 }
 metrics[scene]=runs.sort((a,b)=>a-b).map(v=>Number(v.toFixed(2)))
}
console.log(JSON.stringify(metrics))
fixture.free()
