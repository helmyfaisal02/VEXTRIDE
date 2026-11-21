import RAPIER from '@dimforge/rapier3d-compat'
import { fleetFixture } from './vehicle-fleet-fixture'
import { GARAGE } from '../src/game/garage/garageConfig'
import { garageRuntime,useGarageStore } from '../src/game/garage/garageState'
import { createParkingDetector } from '../src/game/garage/parkingDetector'
import { VEHICLES,type VehicleDefinition } from '../src/game/vehicles/vehicleConfig'
import { vehicleRuntime } from '../src/game/vehicles/vehicleState'
import { createVehicleAssets } from '../src/game/vehicles/Vehicle'
import { bindPlayerPaint } from '../src/game/vehicles/playerPaintBinding'
import { inputState,resetInput } from '../src/game/input/inputState'
import { processInteraction } from '../src/game/interactions/interactionCoordinator'
import { useCharacterStore } from '../src/game/state/characterStore'
import { useDialogueStore } from '../src/game/interactions/dialogueState'
import { useMissionStore,initialMissionProgress } from '../src/game/missions/missionState'
import { initialEconomyState } from '../src/game/economy/economyState'
import { FIXED_DT } from '../src/game/character/config'
/** Test fixture only: no production reset action. Approaches are placed outside bays; driving is physical. */
export function economyFixture(){
 useMissionStore.setState({progress:initialMissionProgress(),completionNotice:false,economy:initialEconomyState()});useDialogueStore.getState().close()
 useCharacterStore.getState().setName('Economy Test');useCharacterStore.getState().confirm()
 const f=fleetFixture(true),detector=createParkingDetector(),t=GARAGE.terminal
 garageRuntime.terminal=f.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(t.x,t.y,t.z));f.world.createCollider(RAPIER.ColliderDesc.cuboid(t.width/2,t.height/2,t.depth/2).setTranslation(0,t.height/2,0),garageRuntime.terminal)
 const player=f.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(t.x,t.y+.9,t.z+1.5).lockRotations());f.world.createCollider(RAPIER.ColliderDesc.capsule(.6,.3),player);vehicleRuntime.pedestrian=player
 const assets=VEHICLES.map(d=>createVehicleAssets(d)),unbind=assets.map((a,i)=>bindPlayerPaint(VEHICLES[i].id,a.geometries.body,a.materials.body))
 const step=(n=1,id:VehicleDefinition['id']|null=null)=>{for(let j=0;j<n;j++){f.step(1,id);detector.step(f.physics,FIXED_DT)}}
 const atTerminal=()=>{player.setTranslation({x:t.x,y:t.y+.94,z:t.z+1.5},true);player.setLinvel({x:0,y:0,z:0},true);step(3);inputState.interactQueued=true;processInteraction(f.physics)}
 const park=(d:VehicleDefinition,index=0)=>{
  useGarageStore.getState().close();const b=GARAGE.bays[index];f.place(d,b.x,b.z+6.5,0);player.setTranslation({x:b.x+2.2,y:b.y+.94,z:b.z+6.5},true);step(3)
  inputState.interactQueued=true;processInteraction(f.physics)
  const car=f.entry(d.id).body
  for(let j=0;j<500;j++){
   if(car.translation().z>b.z+.15){inputState.forward=Math.abs(f.speed(d.id))<2.1;inputState.jumpHeld=false}else{inputState.forward=false;inputState.jumpHeld=true}
   step(1,d.id);if(car.translation().z<=b.z+.15&&Math.abs(f.speed(d.id))<.03)break
  }
  resetInput();step(90,d.id);inputState.interactQueued=true;processInteraction(f.physics);step(75);atTerminal()
 }
 const free=()=>{useGarageStore.getState().close();detector.clear();garageRuntime.terminal=null;vehicleRuntime.pedestrian=null;unbind.forEach(fn=>fn());for(const a of assets){Object.values(a.geometries).forEach(g=>g.dispose());Object.values(a.materials).forEach(m=>m.dispose())}f.free()}
 return {...f,step,player,assets,park,atTerminal,detector,free}
}
