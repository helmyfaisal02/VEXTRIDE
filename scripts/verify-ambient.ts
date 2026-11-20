import assert from 'node:assert/strict'
import RAPIER from '@dimforge/rapier3d-compat'
import { ambientFixture } from './ambient-fixture'
import { TRAFFIC,PEDESTRIANS } from '../src/game/ambient/ambientConfig'
import { createRoutePose,sampleRoute,angleDelta } from '../src/game/ambient/ambientRoutes'
import { trafficClear } from '../src/game/ambient/ambientSim'
import { CITY } from '../src/game/city/cityLayout'
import { surfaceHeightAt } from '../src/game/city/citySurface'
import { NPCS } from '../src/game/npcs/npcConfig'
import { VEHICLES } from '../src/game/vehicles/vehicleConfig'
import { groundPose,createPose } from '../src/game/character/characterPoses'
await RAPIER.init()
let count=0
function test(name:string,run:()=>void){run();count++;console.log(`PASS  ${name}`)}
test('fixed population: exactly two traffic cars and three noninteractive walkers with unique separate IDs',()=>{
 assert.equal(TRAFFIC.length,2);assert.equal(PEDESTRIANS.length,3)
 const ids=[...TRAFFIC,...PEDESTRIANS].map(d=>d.id);assert.equal(new Set(ids).size,5)
 assert.ok(ids.every(id=>!NPCS.some(n=>n.id===id)&&!VEHICLES.some(v=>v.id===id)))
 assert.deepEqual(TRAFFIC.map(d=>d.vehicle.modelType),['coupe','sedan']);assert.ok(TRAFFIC.every(d=>d.speed>=6&&d.speed<=10))
})
for(const d of TRAFFIC){
 test(`${d.id}: graph-connected legal directed loop, continuous heading and full swept chassis clearance`,()=>{
  const f=ambientFixture(),a=f.traffic.find(a=>a.definition.id===d.id)!,route=d.route,out=createRoutePose()
  assert.equal(route.lanes.length,4)
  for(let i=0;i<route.lanes.length;i++){
   const lane=route.lanes[i],next=route.lanes[(i+1)%route.lanes.length],movement=route.turns[i]
   assert.ok(CITY.laneEdges.includes(lane)&&lane.to===next.from&&lane.roadId!==next.roadId)
   assert.ok(CITY.movements.includes(movement)&&movement.from===lane.id&&movement.to===next.id)
  }
  for(let s=0;s<route.length;s+=.35){
   sampleRoute(route,s,out)
   assert.ok(trafficClear(f.physics,a.body,a.sim,d,out.x,out.z,out.yaw),`blocked route at ${s.toFixed(2)} (${out.x},${out.z})`)
   const previous=sampleRoute(route,s-.05,createRoutePose()),next=sampleRoute(route,s+.05,createRoutePose())
   assert.ok(Math.abs(angleDelta(previous.yaw,next.yaw))<.1)
   if(!out.movementId){const lane=route.lanes.find(l=>l.id===out.laneId)!;assert.ok((next.x-previous.x)*lane.dir.x+(next.z-previous.z)*lane.dir.z>0)}
  }
  const p=sampleRoute(route,d.start,out);assert.ok(Number.isFinite(p.yaw));f.free()
 })
 test(`${d.id}: three minutes of actual-city loops, smooth speed caps, orientation, wheel movement and constant resources`,()=>{
  const f=ambientFixture(),a=f.traffic.find(a=>a.definition.id===d.id)!,start=a.sim.distance,bodies=f.world.bodies.len(),colliders=f.world.colliders.len()
  let loops=0,last=start,maximum=0,previous=0,previousYaw=a.sim.pose.yaw,maxYawStep=0
  for(let i=0;i<10800;i++){
   f.step(1);const s=a.sim,p=a.body.translation(),q=a.body.rotation()
   if(s.distance<last-1)loops++;last=s.distance;maximum=Math.max(maximum,s.speed)
   assert.ok([p.x,p.y,p.z,q.x,q.y,q.z,q.w,s.speed,s.roll].every(Number.isFinite))
   assert.ok(Math.abs(s.speed-previous)<3.5/60+.002,`unexpected speed jump ${previous}->${s.speed}`);previous=s.speed
   const yaw=Math.atan2(2*q.w*q.y,1-2*q.y*q.y);maxYawStep=Math.max(maxYawStep,Math.abs(angleDelta(previousYaw,yaw)));previousYaw=yaw
   assert.ok(Math.abs(p.y-(.03+d.vehicle.rideHeight))<1e-5&&s.speed<=d.speed+.001)
  }
  assert.ok(loops>=2&&maximum>d.speed-.1,`loops=${loops}, max=${maximum}`);assert.ok(maxYawStep<.1&&Math.abs(a.sim.roll)>100)
  assert.equal(f.world.bodies.len(),bodies);assert.equal(f.world.colliders.len(),colliders)
  console.log(`INFO ${d.id}: ${loops} loops, max ${maximum.toFixed(2)} m/s, max heading step ${maxYawStep.toFixed(4)}`)
  f.free()
 })
 test(`${d.id}: stationary obstruction yields with following gap and resumes when removed`,()=>{
  const f=ambientFixture(),a=f.traffic.find(a=>a.definition.id===d.id)!,pose=sampleRoute(d.route,d.start+30,createRoutePose())
  const obstacle=f.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(pose.x,1,pose.z))
  f.world.createCollider(RAPIER.ColliderDesc.cuboid(1,1,2).setRotation({x:0,y:Math.sin(pose.yaw/2),z:0,w:Math.cos(pose.yaw/2)}),obstacle)
  f.step(600);assert.ok(a.sim.speed<.05&&a.sim.blocked)
  const p=a.body.translation();assert.ok(Math.hypot(p.x-pose.x,p.z-pose.z)>d.vehicle.length/2+2)
  const roll=a.sim.roll;f.step(120);assert.ok(Math.abs(a.sim.roll-roll)<.001)
  f.world.removeRigidBody(obstacle);f.step(180);assert.ok(a.sim.speed>2);f.free()
 })
 test(`${d.id}: player's dynamic car ahead is never overlapped or actively pushed`,()=>{
  const f=ambientFixture(),a=f.traffic.find(a=>a.definition.id===d.id)!,p=sampleRoute(d.route,d.start+25,createRoutePose()),car=f.entry('street-coupe').body
  car.setTranslation({x:p.x,y:.53,z:p.z},true);car.setRotation({x:0,y:Math.sin(p.yaw/2),z:0,w:Math.cos(p.yaw/2)},true);car.setLinvel({x:0,y:0,z:0},true)
  f.step(600);assert.ok(a.sim.blocked&&a.sim.speed<.05)
  const v=car.linvel();assert.ok(Math.hypot(v.x,v.z)<.01)
  assert.ok(Math.hypot(car.translation().x-p.x,car.translation().z-p.z)<.02)
  f.free()
 })
}
for(const d of PEDESTRIANS){
 test(`${d.id}: entire waypoint corridor is supported pavement, clear of props/named NPCs, outside roads`,()=>{
  const f=ambientFixture(),a=f.pedestrians.find(a=>a.definition.id===d.id)!,[p,q]=d.points
  for(let t=0;t<=1;t+=.025){const x=p.x+(q.x-p.x)*t,z=p.z+(q.z-p.z)*t,y=surfaceHeightAt(x,z)
   assert.ok(y>.1)
   assert.ok(!CITY.roads.some(r=>x>r.rect.minX-.4&&x<r.rect.maxX+.4&&z>r.rect.minZ-.4&&z<r.rect.maxZ+.4))
   assert.equal(f.world.intersectionWithShape({x,y:y+.93,z},{x:0,y:0,z:0,w:1},a.sim.shape,RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,undefined,undefined,a.body),null)
   assert.ok(NPCS.every(n=>Math.hypot(n.spawn.x-x,n.spawn.z-z)>3))
  }
  f.free()
 })
 test(`${d.id}: two minutes of walking, endpoint pauses, smooth turns and bounded gait`,()=>{
  const f=ambientFixture(),a=f.pedestrians.find(a=>a.definition.id===d.id)!,pose=createPose();let paused=0,walking=0,lastYaw=a.sim.yaw,lastPosition=a.body.translation()
  for(let i=0;i<7200;i++){
   f.step(1);const s=a.sim,p=a.body.translation(),[start,end]=d.points
   assert.ok(p.x>=Math.min(start.x,end.x)-.01&&p.x<=Math.max(start.x,end.x)+.01&&p.z>=Math.min(start.z,end.z)-.01&&p.z<=Math.max(start.z,end.z)+.01)
   assert.ok(Math.abs(p.y-(surfaceHeightAt(p.x,p.z)+.93))<1e-5)
   const dx=p.x-lastPosition.x,dz=p.z-lastPosition.z,traveled=Math.hypot(dx,dz)
   if(traveled>.001)assert.ok((dx*Math.sin(s.yaw)+dz*Math.cos(s.yaw))/traveled>.98,'walker must face movement, including endpoints')
   if(s.wait>0)assert.ok(traveled<.001,'endpoint pause must hold position')
   lastPosition=p
   assert.ok(Math.abs(angleDelta(lastYaw,s.yaw))<=1.8/60+.0001);lastYaw=s.yaw
   if(s.speed>.5)walking++;else paused++
   groundPose(pose,s.phase,s.move,0,s.time);assert.ok(Object.values(pose).every(Number.isFinite))
  }
  assert.ok(walking>3000&&paused>500);f.free()
 })
 test(`${d.id}: local capsule sweep stops before player-sized obstacle and resumes`,()=>{
  const f=ambientFixture(),a=f.pedestrians.find(a=>a.definition.id===d.id)!,[p,q]=d.points
  const obstacle=f.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation((p.x+q.x)/2,surfaceHeightAt(p.x,p.z)+.9,(p.z+q.z)/2))
  f.world.createCollider(RAPIER.ColliderDesc.capsule(.6,.3),obstacle)
  f.step(600);assert.ok(a.sim.blocked&&a.sim.speed===0)
  const pos=a.body.translation();assert.ok(Math.hypot(pos.x-obstacle.translation().x,pos.z-obstacle.translation().z)>.6)
  f.world.removeRigidBody(obstacle);f.step(120);assert.ok(a.sim.speed>.5);f.free()
 })
}
test('synthetic 15/30/60/144 FPS schedules produce the same fixed-step ambient state',()=>{
 const run=(fps:number)=>{const f=ambientFixture();let accumulator=0,ticks=0
  for(let i=0;i<fps*30;i++){accumulator+=1/fps;while(accumulator+1e-10>=1/60){f.step(1);ticks++;accumulator-=1/60}}
  assert.equal(ticks,1800);const result=[...f.traffic,...f.pedestrians].flatMap(a=>{const p=a.body.translation();return[p.x,p.y,p.z,a.sim.speed]});f.free();return result
 }
 const baseline=run(60);for(const fps of[15,30,144])assert.ok(run(fps).every((v,i)=>Math.abs(v-baseline[i])<1e-5))
})
console.log(`ALL PASS (${count} ambient groups)`)
