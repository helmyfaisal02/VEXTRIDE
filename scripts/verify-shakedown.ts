import assert from 'node:assert/strict'
import RAPIER from '@dimforge/rapier3d-compat'
import { MISSIONS,MOTOR_ROW_SHAKEDOWN } from '../src/game/missions/missionDefinitions'
import { CHECKPOINTS,SHAKEDOWN_LANES,validateCheckpointRoute } from '../src/game/missions/checkpointRoute'
import { crossesCheckpoint,type VehicleSample } from '../src/game/missions/checkpointCrossing'
import { initialMissionProgress,reduceMission,missionStatus,availableMission,useMissionStore,type MissionProgress } from '../src/game/missions/missionState'
import { missionHUD,missionTarget } from '../src/game/missions/missionPresentation'
import { createCheckpointObserver } from '../src/game/missions/MissionDriver'
import { CITY } from '../src/game/city/cityLayout'
import { DRIVEWAYS } from '../src/game/city/driveways'
import { VEHICLES } from '../src/game/vehicles/vehicleConfig'
import { getVehicleRuntime,useVehicleStore } from '../src/game/vehicles/vehicleState'
import { inputState,resetInput } from '../src/game/input/inputState'
import { useCharacterStore } from '../src/game/state/characterStore'
import { FIXED_DT } from '../src/game/character/config'
import { fleetFixture } from './vehicle-fleet-fixture'
await RAPIER.init()
let count=0
const test=(name:string,run:()=>void)=>{run();count++;console.log(`PASS  ${name}`)}
const done=()=>{
 let p=initialMissionProgress()
 p=reduceMission(p,{kind:'accept',missionId:'first-contact',npcId:'maya',session:1})
 p=reduceMission(p,{kind:'acknowledge',missionId:'first-contact',objectiveId:'meet-marcus',npcId:'marcus',session:2})
 return reduceMission(p,{kind:'acknowledge',missionId:'first-contact',objectiveId:'return-to-maya',npcId:'maya',session:3})
}
const active=()=>reduceMission(done(),{kind:'accept',missionId:'motor-row-shakedown',npcId:'marcus',session:4})
function samples(index=0,id:VehicleSample['vehicleId']='street-coupe'){
 const g=CHECKPOINTS[index],yaw=Math.atan2(-g.direction.x,-g.direction.z)
 const p={vehicleId:id,...g.spawn,y:g.spawn.y+.55,vx:g.direction.x*6,vz:g.direction.z*6,yaw,up:1,revision:0}
 return [{...p,x:p.x-g.direction.x*.05,z:p.z-g.direction.z*.05},{...p,x:p.x+g.direction.x*.05,z:p.z+g.direction.z*.05}] as const
}
function cross(p:MissionProgress,index:number){const [previous,current]=samples(index);return reduceMission(p,{kind:'checkpoint',missionId:'motor-row-shakedown',objectiveId:CHECKPOINTS[index].id,previous,current,dt:FIXED_DT})}
test('exactly two distinct missions; First Contact dialogue and ordered objectives retained',()=>{
 assert.equal(MISSIONS.length,2);assert.equal(new Set(MISSIONS.map(m=>m.id)).size,2)
 assert.deepEqual(MISSIONS[0].objectives.map(o=>o.id),['meet-marcus','return-to-maya'])
 assert.equal(MOTOR_ROW_SHAKEDOWN.requires,'first-contact');assert.equal(MOTOR_ROW_SHAKEDOWN.objectives.length,4)
})
test('locked until First Contact completion, one active mission, explicit expected giver acceptance',()=>{
 for(const p of [initialMissionProgress(),reduceMission(initialMissionProgress(),{kind:'accept',missionId:'first-contact',npcId:'maya',session:1})]){
  assert.equal(missionStatus(p,'motor-row-shakedown'),'LOCKED');assert.equal(availableMission(p,'marcus'),undefined)
  assert.equal(reduceMission(p,{kind:'accept',missionId:'motor-row-shakedown',npcId:'marcus',session:2}),p)
 }
 assert.equal(missionStatus(done(),'motor-row-shakedown'),'AVAILABLE');assert.equal(availableMission(done(),'marcus'),MOTOR_ROW_SHAKEDOWN)
 assert.equal(missionStatus(active(),'first-contact'),'COMPLETED');assert.equal(missionStatus(active(),'motor-row-shakedown'),'ACTIVE')
 assert.equal(availableMission(active(),'marcus'),undefined)
})
test('three unique gates derive from connected existing lanes and legal right turns, north parking access upstream',()=>{
 assert.ok(validateCheckpointRoute());assert.equal(CHECKPOINTS.length,3);assert.equal(new Set(CHECKPOINTS.map(c=>c.id)).size,3)
 assert.equal(DRIVEWAYS.find(d=>d.id==='north-parking')!.roadId,'RX03')
 for(let i=1;i<SHAKEDOWN_LANES.length;i++)assert.ok(CITY.movements.some(m=>m.from===SHAKEDOWN_LANES[i-1]&&m.to===SHAKEDOWN_LANES[i]&&m.kind==='right'))
 assert.deepEqual(SHAKEDOWN_LANES.map(id=>CITY.roads.find(r=>r.id===CITY.laneEdges.find(l=>l.id===id)!.roadId)!.class),['main','main','secondary'])
})
test('swept gate detects only correct direction, speed, lane alignment and height',()=>{
 const [a,b]=samples(),id=CHECKPOINTS[0].id
 assert.ok(crossesCheckpoint(id,a,b,FIXED_DT));assert.ok(!crossesCheckpoint(id,b,a,FIXED_DT))
 for(const change of [{vx:0,vz:0},{yaw:b.yaw+Math.PI},{up:0},{y:5},{x:NaN},{revision:1},{vehicleId:'city-sedan' as const}])assert.ok(!crossesCheckpoint(id,a,{...b,...change},FIXED_DT))
 assert.ok(!crossesCheckpoint(id,{...a,z:a.z+2},{...b,z:b.z+2},FIXED_DT))
 assert.ok(!crossesCheckpoint(id,b,b,FIXED_DT));assert.ok(!crossesCheckpoint(id,{...a,x:a.x-20},b,FIXED_DT));assert.ok(!crossesCheckpoint(id,a,b,1))
})
test('checkpoint order, duplicate frames and ordinary dialogue cannot skip gates',()=>{
 const p=active();assert.equal(cross(p,1),p);assert.equal(cross(p,2),p)
 assert.equal(reduceMission(p,{kind:'acknowledge',missionId:p.missionId,objectiveId:'checkpoint-a',npcId:'marcus',session:5}),p)
 const a=cross(p,0);assert.equal(a.objectiveId,'checkpoint-b');assert.equal(cross(a,0),a)
 const b=cross(a,1),c=cross(b,2);assert.equal(c.objectiveId,'report-to-marcus')
 assert.equal(reduceMission(c,{kind:'acknowledge',missionId:c.missionId,objectiveId:'report-to-marcus',npcId:'maya',session:5}),c)
 const complete=reduceMission(c,{kind:'acknowledge',missionId:c.missionId,objectiveId:'report-to-marcus',npcId:'marcus',session:5})
 assert.equal(complete.status,'COMPLETED');assert.deepEqual(complete.completed,['first-contact','motor-row-shakedown'])
 assert.equal(reduceMission(complete,{kind:'accept',missionId:c.missionId,npcId:'marcus',session:6}),complete)
 assert.equal(missionTarget(complete),null);assert.equal(missionHUD(complete),null)
})
test('current checkpoint HUD marker changes A/B/C then actual Marcus, preserving completed history',()=>{
 let p=active()
 for(let i=0;i<3;i++){assert.equal(missionTarget(p),CHECKPOINTS[i]);assert.ok(missionHUD(p)!.objective.includes(`${i+1}/3`));p=cross(p,i);assert.equal(missionStatus(p,'first-contact'),'COMPLETED')}
 assert.equal(missionTarget(p)!.name,'Marcus')
})
useCharacterStore.getState().setName('Shakedown Test');useCharacterStore.getState().confirm()
for(const d of VEHICLES){
 test(`${d.id}: real Rapier driving crosses all actual road gates with approved controller and no collider changes`,()=>{
  const f=fleetFixture(true),observer=createCheckpointObserver();useMissionStore.setState({progress:active(),completionNotice:false})
  const bodyCount=f.world.bodies.len(),colliderCount=f.world.colliders.len()
  for(const g of CHECKPOINTS){
   const yaw=Math.atan2(-g.direction.x,-g.direction.z)
   f.place(d,g.spawn.x-g.direction.x*9,g.spawn.z-g.direction.z*9,yaw)
   useVehicleStore.getState().setDriving(true,d.id);observer.reset();inputState.forward=true
   for(let j=0;j<220&&useMissionStore.getState().progress.objectiveId===g.id;j++){f.step(1,d.id);observer.step(FIXED_DT)}
   assert.notEqual(useMissionStore.getState().progress.objectiveId,g.id)
   resetInput();useVehicleStore.getState().setDriving(false)
  }
  assert.equal(useMissionStore.getState().progress.objectiveId,'report-to-marcus');assert.equal(f.world.bodies.len(),bodyCount);assert.equal(f.world.colliders.len(),colliderCount);f.free()
 })
}
test('walking, ambient-only motion, creator, revision changes and remount cannot spoof occupied-vehicle gate',()=>{
 const f=fleetFixture(true),d=VEHICLES[0],g=CHECKPOINTS[0],r=getVehicleRuntime(d.id)
 f.place(d,g.spawn.x-.1,g.spawn.z,-Math.PI/2);const car=r.body!,observer=createCheckpointObserver()
 useMissionStore.setState({progress:active(),completionNotice:false})
 const p=useMissionStore.getState().progress
 car.setLinvel({x:6,y:0,z:0},true);observer.step(FIXED_DT);car.setTranslation({...car.translation(),x:g.spawn.x+.1},true);observer.step(FIXED_DT)
 assert.equal(useMissionStore.getState().progress,p)
 useVehicleStore.getState().setDriving(true,d.id);car.setTranslation({...car.translation(),x:g.spawn.x-.05},true);observer.step(FIXED_DT)
 r.state.recoveryRevision++;car.setTranslation({...car.translation(),x:g.spawn.x+.05},true);observer.step(FIXED_DT);assert.equal(useMissionStore.getState().progress,p)
 car.setTranslation({...car.translation(),x:g.spawn.x-.05},true);observer.step(FIXED_DT);observer.reset();car.setTranslation({...car.translation(),x:g.spawn.x+.05},true);observer.step(FIXED_DT);assert.equal(useMissionStore.getState().progress,p)
 useCharacterStore.getState().openMenu();observer.step(FIXED_DT);useCharacterStore.getState().cancel();assert.equal(useMissionStore.getState().progress,p)
 f.free()
})
console.log(`ALL PASS (${count} shakedown groups)`)
