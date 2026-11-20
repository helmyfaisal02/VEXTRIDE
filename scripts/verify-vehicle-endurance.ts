import assert from 'node:assert/strict'
import RAPIER from '@dimforge/rapier3d-compat'
import { PerspectiveCamera,Vector3 } from 'three'
import { fleetFixture } from './vehicle-fleet-fixture'
import { VEHICLES } from '../src/game/vehicles/vehicleConfig'
import { bodyYaw } from '../src/game/vehicles/vehicleSim'
import { createRecoveryState,stepRecovery } from '../src/game/vehicles/vehicleRecovery'
import { inputState,resetInput } from '../src/game/input/inputState'
import { vehicleSignals } from '../src/game/vehicles/vehicleSignals'
import { constrainVehicleCamera } from '../src/game/camera/vehicleCameraCollision'
import { CAMERA_PROBE_RADIUS } from '../src/game/camera/cameraCollision'
import { ENVIRONMENT } from '../src/game/environment/envLayout'

await RAPIER.init()
let count=0
function test(name:string,run:()=>void){run();count++;console.log(`PASS  ${name}`)}
for(const d of VEHICLES){
 test(`${d.id}: 30 simulated minutes of mixed driving remain finite, grounded and bounded`,()=>{
  const s=fleetFixture();s.place(d,0,0);const e=s.entry(d.id),recovery=createRecoveryState()
  const bodies=s.world.bodies.len(),colliders=s.world.colliders.len()
  let maxSpeed=0,maxY=0
  for(let tick=0;tick<108000;tick++){
   const phase=tick%1200
   inputState.forward=phase<480||(phase>=900&&phase<1140)
   inputState.backward=phase>=480&&phase<720||phase>=780&&phase<900
   inputState.jumpHeld=phase>=720&&phase<780
   const p=e.body.translation(),yaw=bodyYaw(e.body)
   const desired=Math.atan2(p.x,p.z),error=Math.atan2(Math.sin(desired-yaw),Math.cos(desired-yaw))
   const left=Math.hypot(p.x,p.z)<100?true:error*(s.speed(d.id)<-.2?-1:1)>0
   inputState.left=left;inputState.right=!left
   stepRecovery(recovery,s.physics,e.body,d,e.sim,true,1/60);s.step(1,d.id)
   const v=e.body.linvel(),q=e.body.rotation(),position=e.body.translation(),speed=s.speed(d.id)
   assert.ok([position.x,position.y,position.z,v.x,v.y,v.z,q.x,q.y,q.z,q.w,e.sim.roll].every(Number.isFinite))
   assert.ok(speed<=d.maxSpeed+.02&&speed>=-d.reverseSpeed-.02)
   assert.ok(position.y>.3&&position.y<d.rideHeight+.12&&Math.hypot(position.x,position.z)<180)
   assert.ok(Math.abs(q.x)+Math.abs(q.z)<.0001)
   maxSpeed=Math.max(maxSpeed,speed);maxY=Math.max(maxY,position.y)
  }
  assert.ok(maxSpeed>d.maxSpeed-.1)
  resetInput();s.step(300);const roll=e.sim.roll,position=e.body.translation();s.step(600)
  assert.ok(e.body.isSleeping()&&Math.abs(e.sim.roll-roll)<1e-6)
  assert.ok(Math.hypot(e.body.translation().x-position.x,e.body.translation().z-position.z)<1e-6)
  assert.equal(s.world.bodies.len(),bodies);assert.equal(s.world.colliders.len(),colliders)
  assert.ok(!recovery.eligible)
  console.log(`INFO ${d.id}: 108000 mixed steps, peak ${maxSpeed.toFixed(2)} m/s, peak Y ${maxY.toFixed(3)}, body/collider counts ${bodies}/${colliders}`)
  s.free()
 })
 test(`${d.id}: identical fixed-step replay at synthetic 15/30/60/144 rendering FPS`,()=>{
  const run=(fps:number)=>{
   const s=fleetFixture();s.place(d,0,0);let tick=0,accumulator=0
   for(let frame=0;frame<fps*120;frame++){
    accumulator+=1/fps
    while(accumulator+1e-10>=1/60){
     const phase=tick%600
     inputState.forward=phase<300;inputState.backward=phase>=300&&phase<480;inputState.jumpHeld=phase>=480&&phase<540
     inputState.left=tick%1200<600;inputState.right=!inputState.left
     s.step(1,d.id);tick++;accumulator-=1/60
    }
   }
   assert.equal(tick,7200)
   const e=s.entry(d.id),p=e.body.translation(),result=[p.x,p.y,p.z,s.speed(d.id),e.sim.roll,bodyYaw(e.body)]
   s.free();return result
  }
  const reference=run(60)
  for(const fps of[15,30,144])assert.ok(run(fps).every((v,i)=>Math.abs(v-reference[i])<1e-5))
 })
 test(`${d.id}: repeated pedal/direction changes never latch brake or reverse lamps`,()=>{
  resetInput()
  for(let i=0;i<1000;i++){
   inputState.forward=true;assert.deepEqual(vehicleSignals(10,inputState,true),{braking:false,reversing:false})
   inputState.backward=true;assert.ok(vehicleSignals(10,inputState,true).braking)
   inputState.forward=false;assert.deepEqual(vehicleSignals(-3,inputState,true),{braking:false,reversing:true})
   inputState.jumpHeld=true;assert.deepEqual(vehicleSignals(-3,inputState,true),{braking:true,reversing:false})
   resetInput();assert.deepEqual(vehicleSignals(0,inputState,true),{braking:false,reversing:false})
  }
 })
}
test('collision-corrected vehicle handoff keeps focus centered; unobstructed orientation unchanged',()=>{
 const world=new RAPIER.World({x:0,y:0,z:0}),physics={world,rapier:RAPIER},probe=new RAPIER.Ball(CAMERA_PROBE_RADIUS)
 world.createCollider(RAPIER.ColliderDesc.cuboid(5,3,.1).setTranslation(0,2,4));world.step()
 const camera=new PerspectiveCamera(),focus=new Vector3(0,1,0),scratch=new Vector3()
 camera.position.set(0,2,8);camera.lookAt(new Vector3(10,1,7))
 assert.ok(constrainVehicleCamera(physics,camera,focus,probe,scratch))
 assert.ok(camera.getWorldDirection(new Vector3()).dot(focus.clone().sub(camera.position).normalize())>.99999)
 assert.equal(world.intersectionWithShape(camera.position,{x:0,y:0,z:0,w:1},probe),null)
 const q=camera.quaternion.clone()
 assert.equal(constrainVehicleCamera(physics,camera,focus,probe,scratch),false)
 assert.ok(q.angleTo(camera.quaternion)<1e-6)
 world.free()
})
test('CCD chassis respects representative actual building/furniture shapes',()=>{
 for(const pattern of[/^building-\d+$/,/:trunk$/,/:pole$/, /^bench-/,/container/]){
  const c=ENVIRONMENT.colliders.find(c=>pattern.test(c.id))!
  assert.ok(c,`fixture missing ${String(pattern)}`)
  const s=fleetFixture();const d=VEHICLES[0]
  const halfX=(c.rect.maxX-c.rect.minX)/2,halfZ=(c.rect.maxZ-c.rect.minZ)/2
  s.world.createCollider(RAPIER.ColliderDesc.cuboid(halfX,(c.y1-c.y0)/2,halfZ).setTranslation(0,(c.y0+c.y1)/2,0))
  s.place(d,0,halfZ+6)
  s.entry(d.id).body.setLinvel({x:0,y:0,z:-d.maxSpeed},true)
  inputState.forward=true;let peakY=0
  for(let i=0;i<360;i++){s.step(1,d.id);peakY=Math.max(peakY,s.entry(d.id).body.translation().y)}
  const p=s.entry(d.id).body.translation()
  assert.ok(Number.isFinite(p.y)&&p.y>.3&&(p.z>halfZ+1.9||peakY>d.rideHeight+c.y1-.1),`${c.id}: z=${p.z}, peakY=${peakY}`)
  s.free()
 }
})
console.log(`ALL PASS (${count} endurance groups)`)
