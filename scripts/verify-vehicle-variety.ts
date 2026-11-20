import assert from 'node:assert/strict'
import RAPIER from '@dimforge/rapier3d-compat'
import { Box3,Group,Mesh } from 'three'
import { VEHICLES,COUPE,SEDAN,PICKUP,PICKUP_APRON,vehicleWheels } from '../src/game/vehicles/vehicleConfig'
import { fleetFixture } from './vehicle-fleet-fixture'
import { createVehicleAssets } from '../src/game/vehicles/Vehicle'
import { inputState,resetInput } from '../src/game/input/inputState'
import { bodyYaw } from '../src/game/vehicles/vehicleSim'
import { nearestVehicle,findVehicleExit,processVehicleInteraction } from '../src/game/vehicles/vehicleInteraction'
import { vehicleRuntime,useVehicleStore,getActiveVehicleDefinition } from '../src/game/vehicles/vehicleState'
import { CITY } from '../src/game/city/cityLayout'
import { DRIVEWAYS } from '../src/game/city/driveways'
import { ENVIRONMENT } from '../src/game/environment/envLayout'
import { overlaps } from '../src/game/environment/propLayout'

await RAPIER.init()
let count=0
function test(name:string,run:()=>void){run();count++;console.log(`PASS  ${name}`)}
test('exactly three unique definitions with meaningful size, mass and handling differences',()=>{
  assert.equal(VEHICLES.length,3);assert.equal(new Set(VEHICLES.map(d=>d.id)).size,3)
  assert.deepEqual(VEHICLES.map(d=>d.maxSpeed),[22,18,15]);assert.ok(COUPE.acceleration>SEDAN.acceleration&&SEDAN.acceleration>PICKUP.acceleration)
  assert.ok(COUPE.steeringResponse>SEDAN.steeringResponse&&SEDAN.steeringResponse>PICKUP.steeringResponse)
  assert.ok(COUPE.wheelbase<PICKUP.wheelbase&&PICKUP.steeringAngle<COUPE.steeringAngle)
})
for(const d of VEHICLES)test(`${d.name}: original finite model, four wheels, correct overall proportions`,()=>{
  const a=createVehicleAssets(d),root=new Group()
  for(const part of['body','glass','trim','head','tail'] as const)root.add(new Mesh(a.geometries[part],a.materials[part]))
  for(const w of vehicleWheels(d)){
    const mesh=new Mesh(a.geometries.tire,a.materials.tire);mesh.rotation.z=Math.PI/2;mesh.position.set(w.x,d.wheelRadius-d.rideHeight,w.z);root.add(mesh)
  }
  root.updateMatrixWorld(true);const bounds=new Box3().setFromObject(root),size=bounds.max.clone().sub(bounds.min)
  assert.ok(Math.abs(size.x-d.width)<.06&&Math.abs(size.z-d.length)<.12&&Math.abs(size.y-d.height)<.03,JSON.stringify(size.toArray()))
  assert.equal(vehicleWheels(d).length,4)
  for(const g of Object.values(a.geometries)){assert.ok(Array.from(g.getAttribute('position').array).every(Number.isFinite));g.dispose()}
  Object.values(a.materials).forEach(m=>m.dispose())
})
test('all three spawns are clear, independent, on actual paving, and outside lanes/sidewalks/entrances',()=>{
  const s=fleetFixture(true);s.world.step()
  for(const e of s.entries.values()){
    const d=e.definition,alongX=Math.abs(Math.sin(d.spawnYaw))>.5,hx=(alongX?d.length:d.width)/2,hz=(alongX?d.width:d.length)/2
    const r={minX:d.spawn.x-hx,maxX:d.spawn.x+hx,minZ:d.spawn.z-hz,maxZ:d.spawn.z+hz}
    assert.ok(!CITY.roads.some(road=>overlaps(r,road.rect))&&!CITY.sidewalks.some(w=>overlaps(r,w.rect)))
    assert.ok(!ENVIRONMENT.keepClear.filter(k=>k.id.startsWith('entrance:')||k.id.startsWith('driveway:')).some(k=>overlaps(r,k.rect)))
    assert.ok(ENVIRONMENT.paint.some(p=>p.layer==='base'&&r.minX>=p.rect.minX&&r.maxX<=p.rect.maxX&&r.minZ>=p.rect.minZ&&r.maxZ<=p.rect.maxZ))
    assert.ok(Math.abs(e.body.mass()-d.mass)<1)
    for(let i=0;i<e.body.numColliders();i++){
      const c=e.body.collider(i);assert.equal(s.world.intersectionWithShape(c.translation(),c.rotation(),c.shape,RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,undefined,undefined,e.body),null,d.id)
    }
  }
  assert.ok(PICKUP.spawn.x>PICKUP_APRON.minX&&PICKUP.spawn.x<PICKUP_APRON.maxX);s.free()
})
for(const d of VEHICLES){
  test(`${d.id}: acceleration, speed cap, ground stability, passive/active braking`,()=>{
    const s=fleetFixture();s.place(d,0,0);inputState.forward=true;s.step(360,d.id)
    assert.ok(s.speed(d.id)>d.maxSpeed-.2&&s.speed(d.id)<=d.maxSpeed+.02)
    const b=s.entry(d.id).body;assert.ok(Math.abs(b.translation().y-(.03+d.rideHeight))<.03)
    resetInput();s.step(30,d.id);const coast=s.speed(d.id)
    b.setLinvel({x:0,y:0,z:-d.maxSpeed},true);inputState.backward=true;s.step(30,d.id)
    assert.ok(s.speed(d.id)<coast-3)
    inputState.backward=false;inputState.jumpHeld=true;s.step(180,d.id);assert.ok(Math.abs(s.speed(d.id))<.1)
    assert.ok(Math.abs(b.rotation().x)+Math.abs(b.rotation().z)<.0001);s.free()
  })
  test(`${d.id}: reverse, steering direction, actual wheel travel and parking sleep`,()=>{
    const s=fleetFixture();s.place(d,0,0);inputState.backward=true;s.step(240,d.id)
    assert.ok(s.speed(d.id)<-d.reverseSpeed+.2&&s.speed(d.id)>=-d.reverseSpeed-.02)
    assert.ok(s.entry(d.id).sim.roll>10)
    s.place(d,0,0);inputState.forward=true;s.step(90,d.id);inputState.left=true;s.step(60,d.id)
    assert.ok(bodyYaw(s.entry(d.id).body)>.2&&s.entry(d.id).sim.roll< -5)
    s.place(d,0,0);inputState.backward=true;inputState.left=true;s.step(120,d.id);assert.ok(bodyYaw(s.entry(d.id).body)<-.2)
    resetInput();s.step(360);assert.ok(s.entry(d.id).body.isSleeping())
    const pos=s.entry(d.id).body.translation();inputState.forward=true;s.step(90);assert.deepEqual(s.entry(d.id).body.translation(),pos)
    s.free()
  })
}
test('measured acceleration and turning radius identify coupe/sedan/pickup, not just colors',()=>{
  const acceleration=[],radius=[]
  for(const d of VEHICLES){const s=fleetFixture();s.place(d,0,0);inputState.forward=true;s.step(120,d.id);acceleration.push(s.speed(d.id))
    s.place(d,0,0);s.entry(d.id).body.setLinvel({x:0,y:0,z:-5},true);inputState.left=true;s.step(12,d.id);radius.push(Math.abs(s.speed(d.id)/s.entry(d.id).body.angvel().y));s.free()}
  assert.ok(acceleration[0]>acceleration[1]+2&&acceleration[1]>acceleration[2]+2)
  assert.ok(radius[0]<radius[1]&&radius[1]<radius[2])
})
test('pickup cargo bed is visually and physically open above its recessed floor',()=>{
  const s=fleetFixture();s.place(PICKUP,0,0)
  const b=s.entry(PICKUP.id).body
  const floor=s.world.castRay(new RAPIER.Ray({x:0,y:4,z:1.46},{x:0,y:-1,z:0}),5,true)
  const rail=s.world.castRay(new RAPIER.Ray({x:.91,y:4,z:1.46},{x:0,y:-1,z:0}),5,true)
  assert.ok(floor&&rail&&(4-floor.timeOfImpact)<.75&&(4-rail.timeOfImpact)>1.1)
  assert.equal(b.numColliders(),10);s.free()
})
const city=fleetFixture(true)
for(const d of VEHICLES){
  test(`${d.id}: solid actual garage collision and all 40 existing road segments`,()=>{
    city.place(d,102.2,-88);inputState.forward=true;city.step(240,d.id)
    assert.ok(city.entry(d.id).body.translation().z>=-94+d.length/2-.1)
    for(const road of CITY.roads){const l=CITY.laneEdges.find(l=>l.roadId===road.id)!,x=l.start.x+(l.end.x-l.start.x)*.25,z=l.start.z+(l.end.z-l.start.z)*.25
      city.place(d,x,z,Math.atan2(-l.dir.x,-l.dir.z));inputState.forward=true;city.step(120,d.id)
      const p=city.entry(d.id).body.translation();assert.ok(Math.hypot(p.x-x,p.z-z)>6,`${d.id} ${road.id}`);assert.ok(Math.abs(p.y-(.03+d.rideHeight))<.05)
    }
  })
  test(`${d.id}: substantial container remains collidable`,()=>{
    const s=fleetFixture(),c=ENVIRONMENT.colliders.find(c=>c.id.startsWith('container-'))!,r=c.rect
    s.world.createCollider(RAPIER.ColliderDesc.cuboid((r.maxX-r.minX)/2,(c.y1-c.y0)/2,(r.maxZ-r.minZ)/2).setTranslation((r.minX+r.maxX)/2,(c.y0+c.y1)/2,(r.minZ+r.maxZ)/2));s.world.step()
    s.place(d,(r.minX+r.maxX)/2,r.maxZ+4.5);inputState.forward=true;s.step(180,d.id)
    assert.ok(s.entry(d.id).body.translation().z>=r.maxZ+d.length/2-.1);s.free()
  })
  for(const cut of DRIVEWAYS)test(`${d.id}: grounded traversal of ${cut.id} curb cut`,()=>{
    const edge=cut.side==='S'?cut.crossing.maxZ:cut.crossing.minZ
    city.place(d,cut.center,edge+(cut.side==='S'?4.5:-4.5),cut.side==='S'?0:Math.PI);inputState.forward=true;city.step(190,d.id)
    const p=city.entry(d.id).body.translation();assert.ok(cut.side==='S'?p.z<edge-2.5:p.z>edge+2.5);assert.ok(p.y>.03+d.rideHeight-.05&&p.y<.03+d.rideHeight+.08)
  })
}
test('industrial pickup can drive straight from its actual apron over the existing curb onto the west road',()=>{
  city.place(PICKUP,PICKUP.spawn.x,PICKUP.spawn.z,PICKUP.spawnYaw);inputState.forward=true;city.step(150,PICKUP.id)
  const p=city.entry(PICKUP.id).body.translation();assert.ok(p.x<7&&p.y>.62&&p.y<.86,JSON.stringify(p))
})
city.free()
test('a sleeping parked sedan remains dynamically collidable and wakes on impact',()=>{
  const s=fleetFixture();s.place(COUPE,0,0,Math.PI);s.place(SEDAN,0,7)
  assert.ok(s.entry(SEDAN.id).body.isSleeping())
  inputState.forward=true;let moved=false
  for(let i=0;i<120;i++){s.step(1,COUPE.id);if(s.entry(SEDAN.id).body.translation().z>7.005)moved=true}
  assert.ok(moved)
  assert.ok(s.entry(SEDAN.id).body.translation().z-s.entry(COUPE.id).body.translation().z>4.2)
  s.free()
})
test('nearest valid E interaction, dimension-aware safe exits and sequential vehicle switching retain other poses',()=>{
  const s=fleetFixture();VEHICLES.forEach((d,i)=>s.place(d,i*6,0))
  const player=s.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(-2,.97,0))
  s.world.createCollider(RAPIER.ColliderDesc.capsule(.6,.3),player);vehicleRuntime.pedestrian=player;s.world.step()
  for(const d of VEHICLES){
    const b=s.entry(d.id).body,p=b.translation();player.setTranslation({x:p.x-d.width/2-.9,y:.97,z:p.z},true);s.world.step()
    assert.equal(nearestVehicle(s.physics,player)?.definition.id,d.id)
    processVehicleInteraction(s.physics);assert.ok(useVehicleStore.getState().hint.includes(d.name))
    inputState.interactQueued=true;processVehicleInteraction(s.physics)
    assert.equal(useVehicleStore.getState().activeVehicleId,d.id);assert.equal(getActiveVehicleDefinition().name,d.name);assert.ok(!player.isEnabled())
    const otherPoses=VEHICLES.filter(o=>o.id!==d.id).map(o=>({id:o.id,p:s.entry(o.id).body.translation()}))
    inputState.forward=true;s.step(60,d.id);assert.ok(s.speed(d.id)>2)
    for(const o of otherPoses){const p=s.entry(o.id).body.translation();assert.ok(Math.hypot(p.x-o.p.x,p.y-o.p.y,p.z-o.p.z)<.00001)}
    resetInput();inputState.jumpHeld=true;s.step(120,d.id);resetInput()
    assert.ok(findVehicleExit(s.physics,b,player,d));const pose=b.translation()
    inputState.interactQueued=true;processVehicleInteraction(s.physics);assert.ok(!useVehicleStore.getState().driving&&player.isEnabled());assert.deepEqual(b.translation(),pose)
  }
  // Two cars within range: pick the closer valid car, never definition-order bias.
  s.place(COUPE,0,0);s.place(SEDAN,4,0);player.setTranslation({x:2.2,y:.97,z:0},true);s.world.step()
  assert.equal(nearestVehicle(s.physics,player)?.definition.id,SEDAN.id)
  vehicleRuntime.pedestrian=null;s.free()
})
resetInput();console.log(`ALL PASS (${count} vehicle-variety groups)`)
