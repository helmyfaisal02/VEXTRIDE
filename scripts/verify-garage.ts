import assert from 'node:assert/strict'
import RAPIER from '@dimforge/rapier3d-compat'
import { GARAGE } from '../src/game/garage/garageConfig'
import { fitsParkingBay,createParkingDetector } from '../src/game/garage/parkingDetector'
import { garageRuntime,useGarageStore } from '../src/game/garage/garageState'
import { canUseGarage } from '../src/game/garage/garageInteraction'
import { garageCatalog } from '../src/game/garage/garageCatalog'
import { createGarageGeometry } from '../src/game/garage/garageGeometry'
import { VEHICLES } from '../src/game/vehicles/vehicleConfig'
import { vehicleRuntime,useVehicleStore,getVehicleRuntime } from '../src/game/vehicles/vehicleState'
import { processInteraction,walkingTarget } from '../src/game/interactions/interactionCoordinator'
import { inputState,resetInput } from '../src/game/input/inputState'
import { useCharacterStore } from '../src/game/state/characterStore'
import { useDialogueStore } from '../src/game/interactions/dialogueState'
import { NPCS } from '../src/game/npcs/npcConfig'
import { npcRegistry } from '../src/game/npcs/npcState'
import { ENVIRONMENT } from '../src/game/environment/envLayout'
import { DRIVEWAYS,motorParking } from '../src/game/city/driveways'
import { surfaceHeightAt } from '../src/game/city/citySurface'
import { FIXED_DT } from '../src/game/character/config'
import { useMissionStore } from '../src/game/missions/missionState'
import { fleetFixture } from './vehicle-fleet-fixture'
await RAPIER.init()
useCharacterStore.getState().setName('Garage Test');useCharacterStore.getState().confirm()
let count=0
function test(name:string,run:()=>void){run();count++;console.log(`PASS  ${name}`)}
const overlap=(a:{minX:number;maxX:number;minZ:number;maxZ:number},b:typeof a)=>a.minX<b.maxX&&a.maxX>b.minX&&a.minZ<b.maxZ&&a.maxZ>b.minZ
function fixture(){
 const f=fleetFixture(true),t=GARAGE.terminal,detector=createParkingDetector()
 garageRuntime.terminal=f.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(t.x,t.y,t.z));f.world.createCollider(RAPIER.ColliderDesc.cuboid(t.width/2,t.height/2,t.depth/2).setTranslation(0,t.height/2,0),garageRuntime.terminal)
 const player=f.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(t.x,t.y+.9,t.z+1.5).lockRotations());f.world.createCollider(RAPIER.ColliderDesc.capsule(.6,.3),player);vehicleRuntime.pedestrian=player
 const step=(n=1,id:typeof VEHICLES[number]['id']|null=null)=>{for(let i=0;i<n;i++){f.step(1,id);detector.step(f.physics,FIXED_DT)}}
 const free=()=>{useGarageStore.getState().close();detector.clear();garageRuntime.terminal=null;vehicleRuntime.pedestrian=null;npcRegistry.clear();useDialogueStore.getState().close();f.free()}
 return {...f,player,step,detector,free}
}
test('exterior kiosk is on actual ground, outside solids, Marcus range, driveway and sidewalks',()=>{
 const t=GARAGE.terminal,rect={minX:t.x-.35,maxX:t.x+.35,minZ:t.z-.225,maxZ:t.z+.225}
 assert.equal(surfaceHeightAt(t.x,t.z),t.y)
 assert.ok(!ENVIRONMENT.colliders.some(c=>overlap(rect,c.rect)))
 assert.ok(!DRIVEWAYS.some(d=>overlap(rect,d.approach)||overlap(rect,d.crossing)))
 assert.ok(Math.hypot(t.x-NPCS[0].spawn.x,t.z-NPCS[0].spawn.z)>t.range+NPCS[0].range)
})
test('two existing north-pad stalls have paved chassis-sized clearance and independent approach corridors',()=>{
 assert.equal(GARAGE.bays.length,2);assert.equal(new Set(GARAGE.bays.map(b=>b.id)).size,2)
 const pad=motorParking().north
 for(const b of GARAGE.bays){
  const r={minX:b.x-b.width/2,maxX:b.x+b.width/2,minZ:b.z-b.length/2,maxZ:b.z+b.length/2}
  assert.ok(r.minX>=pad.minX&&r.maxX<=pad.maxX&&r.minZ>=pad.minZ&&r.maxZ<=pad.maxZ)
  assert.ok(!ENVIRONMENT.colliders.some(c=>overlap(r,c.rect)));assert.ok(!DRIVEWAYS.some(d=>overlap(r,d.approach)))
  for(const d of VEHICLES)assert.ok(fitsParkingBay(d,{x:b.x,y:b.y+d.rideHeight,z:b.z,yaw:0,up:1},b))
 }
})
test('full oriented footprint rejects partial, sideways, tilted, airborne and nonfinite placement',()=>{
 const b=GARAGE.bays[0],d=VEHICLES[2],p={x:b.x,y:b.y+d.rideHeight,z:b.z,yaw:0,up:1}
 assert.ok(fitsParkingBay(d,p,b));assert.ok(fitsParkingBay(d,{...p,yaw:Math.PI},b))
 for(const delta of[{x:b.x+.5},{z:b.z+1},{yaw:Math.PI/2},{up:.2},{y:2},{x:NaN}])assert.ok(!fitsParkingBay(d,{...p,...delta},b))
})
test('procedural terminal and merged bay markers are finite, bounded and disposable',()=>{
 const a=createGarageGeometry();for(const g of Object.values(a)){assert.ok(g.getIndex()!.count>0);assert.ok([...g.getAttribute('position').array].every(Number.isFinite));g.dispose()}
 a.shell.computeBoundingBox();assert.ok(a.shell.boundingBox!.max.y<=GARAGE.terminal.height+.001)
})
test('three-vehicle overview uses actual dimensions, limits and neutral availability labels',()=>{
 const f=fixture(),catalog=garageCatalog({})
 assert.equal(catalog.length,3)
 for(let i=0;i<3;i++){const c=catalog[i],d=VEHICLES[i];assert.equal(c.id,d.id);assert.equal(c.name,d.name);assert.equal(c.topSpeed,Math.round(d.maxSpeed*3.6));assert.ok(c.dimensions.includes(d.length.toFixed(2)));assert.ok(c.present);assert.equal(c.bayId,null)}
 f.free()
})
test('real Rapier E opens once on foot, resets held input and cannot interact through a wall',()=>{
 const f=fixture(),t=GARAGE.terminal;f.step(3)
 assert.ok(canUseGarage(f.physics,f.player));assert.equal(walkingTarget(f.physics,f.player)?.kind,'garage')
 inputState.forward=inputState.interactQueued=true;processInteraction(f.physics)
 assert.ok(useGarageStore.getState().open);assert.ok(Object.values(inputState).every(v=>!v));assert.equal(useDialogueStore.getState().active,null)
 assert.ok(!useGarageStore.getState().show());useGarageStore.getState().close()
 const wall=f.world.createCollider(RAPIER.ColliderDesc.cuboid(1,2,.1).setTranslation(t.x,t.y+1,t.z+.75));f.world.step();assert.ok(!canUseGarage(f.physics,f.player));f.world.removeCollider(wall,true)
 f.player.setTranslation({x:t.x+5,y:t.y+.9,z:t.z},true);f.world.step();assert.ok(!canUseGarage(f.physics,f.player));f.free()
})
test('driving, creator and NPC dialogue take priority; Marcus cannot lose his E target to the kiosk',()=>{
 const f=fixture();useVehicleStore.getState().setDriving(true);assert.ok(!useGarageStore.getState().show());useVehicleStore.getState().setDriving(false)
 useCharacterStore.getState().openMenu();assert.ok(!useGarageStore.getState().show());useCharacterStore.getState().cancel()
 useDialogueStore.getState().open(NPCS[0]);assert.ok(!useGarageStore.getState().show());useDialogueStore.getState().close()
 const d=NPCS[0],b=f.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(d.spawn.x,d.spawn.y,d.spawn.z));f.world.createCollider(RAPIER.ColliderDesc.capsule(.68,.27).setTranslation(0,.95,0),b);npcRegistry.set(d.id,{definition:d,body:b})
 f.player.setTranslation({x:d.spawn.x-2,y:d.spawn.y+.9,z:d.spawn.z},true);f.step(2);assert.equal(walkingTarget(f.physics,f.player)?.kind,'npc');inputState.interactQueued=true;processInteraction(f.physics);assert.equal(useDialogueStore.getState().active?.id,'marcus');assert.ok(!useGarageStore.getState().open);f.free()
})
for(const d of VEHICLES)test(`${d.id}: physical drive-in, safe E exit, stable detection and drive-away update real bay status`,()=>{
 const f=fixture(),b=GARAGE.bays[0],mission=useMissionStore.getState().progress
 f.place(d,b.x,b.z+6.5,0);const car=f.entry(d.id).body
 f.player.setTranslation({x:b.x+2.2,y:b.y+.94,z:b.z+6.5},true);f.step(3)
 inputState.interactQueued=true;processInteraction(f.physics);assert.equal(useVehicleStore.getState().activeVehicleId,d.id)
 let crossed=false
 for(let j=0;j<500;j++){
  const z=car.translation().z
  if(z>b.z+.15){inputState.forward=Math.abs(f.speed(d.id))<2.1;inputState.jumpHeld=false}else{inputState.forward=false;inputState.jumpHeld=true;crossed=true}
  f.step(1,d.id)
  if(crossed&&Math.abs(f.speed(d.id))<.03)break
 }
 resetInput();f.step(90,d.id);assert.deepEqual(useGarageStore.getState().occupancy,{})
 assert.ok(fitsParkingBay(d,{...car.translation(),yaw:0,up:1},b))
 inputState.interactQueued=true;processInteraction(f.physics);assert.ok(!useVehicleStore.getState().driving);assert.ok(f.player.isEnabled())
 f.step(75);assert.equal(useGarageStore.getState().occupancy[b.id],d.id);assert.equal(garageCatalog(useGarageStore.getState().occupancy).find(v=>v.id===d.id)!.bayId,b.id)
 const old=useGarageStore.getState().occupancy;f.step(120);assert.equal(useGarageStore.getState().occupancy,old)
 // Re-enter at the actual safe exit. No vehicle placement is used for the driven crossing.
 inputState.interactQueued=true;processInteraction(f.physics);assert.equal(useVehicleStore.getState().activeVehicleId,d.id);inputState.backward=true;f.step(150,d.id);resetInput();assert.deepEqual(useGarageStore.getState().occupancy,{})
 assert.equal(useMissionStore.getState().progress,mission);f.free()
})
test('recovery, stationary spawn/remount and unoccupied/ambient-style entry cannot spoof legitimate parking',()=>{
 const f=fixture(),b=GARAGE.bays[0],d=VEHICLES[0],r=getVehicleRuntime(d.id)
 f.place(d,b.x,b.z,0);f.step(180);assert.deepEqual(useGarageStore.getState().occupancy,{})
 r.state.recoveryRevision++;f.step(180);assert.deepEqual(useGarageStore.getState().occupancy,{})
 f.detector.clear();f.step(180);assert.deepEqual(useGarageStore.getState().occupancy,{})
 // A non-registry moving body cannot become a managed vehicle.
 const ambient=f.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(GARAGE.bays[1].x,b.y+.6,b.z));f.world.createCollider(RAPIER.ColliderDesc.cuboid(.9,.3,2.1),ambient);f.step(180);assert.deepEqual(useGarageStore.getState().occupancy,{})
 f.free()
})
console.log(`ALL PASS (${count} garage groups)`)
