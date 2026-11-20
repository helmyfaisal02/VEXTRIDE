import assert from 'node:assert/strict'
import RAPIER from '@dimforge/rapier3d-compat'
import { fleetFixture } from './vehicle-fleet-fixture'
import { VEHICLES, COUPE } from '../src/game/vehicles/vehicleConfig'
import { stepVehicle } from '../src/game/vehicles/vehicleSim'
import { createRecoveryState, safeRecoveryPose, stepRecovery, vehicleUp } from '../src/game/vehicles/vehicleRecovery'
import { vehicleSignals } from '../src/game/vehicles/vehicleSignals'
import { inputState, resetInput } from '../src/game/input/inputState'
import { useVehicleStore, getVehicleRuntime } from '../src/game/vehicles/vehicleState'
import { FIXED_DT } from '../src/game/character/config'
import { DRIVEWAYS } from '../src/game/city/driveways'

await RAPIER.init()
let count=0
function test(name:string,run:()=>void){run();count++;console.log(`PASS  ${name}`)}
for(const d of VEHICLES){
  test(`${d.id}: high-speed steering reduces angle and response without hurting parking steering`,()=>{
    const s=fleetFixture(),e=s.entry(d.id)
    function sample(speed:number){
      s.place(d,0,0);inputState.left=true
      for(let i=0;i<60;i++){e.body.setLinvel({x:0,y:0,z:-speed},true);stepVehicle(e.sim,s.physics,e.body,inputState,true,FIXED_DT,d)}
      return e.sim.steering
    }
    const low=sample(1),high=sample(d.maxSpeed)
    assert.ok(low>d.steeringAngle*.9);assert.ok(high<low*.8&&high>low*.4)
    s.free()
  })
  test(`${d.id}: throttle ramp, smooth release, reliable reverse and simultaneous pedals brake`,()=>{
    const s=fleetFixture();s.place(d,0,0);inputState.forward=true
    s.step(2,d.id);assert.ok(s.speed(d.id)>0&&s.speed(d.id)<d.acceleration*FIXED_DT*2)
    let previous=s.speed(d.id)
    for(let i=0;i<120;i++){s.step(1,d.id);const speed=s.speed(d.id);assert.ok(speed>=previous-.001);previous=speed}
    inputState.forward=false;s.step(1,d.id);assert.ok(previous-s.speed(d.id)>0&&previous-s.speed(d.id)<.15)
    inputState.forward=inputState.backward=true;s.step(30,d.id);assert.ok(s.speed(d.id)<previous-2)
    inputState.forward=false;s.step(300,d.id);assert.ok(s.speed(d.id)<-d.reverseSpeed+.1)
    inputState.backward=false;inputState.forward=true;s.step(15,d.id);assert.ok(s.speed(d.id)>-d.reverseSpeed+1)
    s.free()
  })
  test(`${d.id}: handbrake overrides W, releases grip smoothly, settles without spin`,()=>{
    const s=fleetFixture();s.place(d,0,0);inputState.forward=true;s.step(100,d.id)
    const speed=s.speed(d.id);inputState.left=inputState.jumpHeld=true;s.step(12,d.id)
    const e=s.entry(d.id),blend=e.sim.handbrake
    assert.ok(s.speed(d.id)<speed-1);assert.ok(blend>.5&&blend<1)
    assert.ok(Math.abs(e.body.angvel().y)<d.yawLimit*d.handbrakeYaw+.01)
    inputState.jumpHeld=false;s.step(1,d.id);assert.ok(e.sim.handbrake>0&&e.sim.handbrake<blend)
    inputState.jumpHeld=true;s.step(180,d.id);assert.ok(Math.abs(s.speed(d.id))<.05&&Math.abs(e.body.angvel().y)<.02)
    assert.ok(vehicleUp(e.body)>.999);s.free()
  })
  test(`${d.id}: normal traction removes lateral slip faster than handbrake traction`,()=>{
    const s=fleetFixture();s.place(d,0,0);const e=s.entry(d.id)
    e.body.setLinvel({x:4,y:0,z:-4},true);s.step(10,d.id);const normal=Math.abs(e.body.linvel().x)
    s.place(d,0,0);e.sim.handbrake=1;inputState.jumpHeld=true;e.body.setLinvel({x:4,y:0,z:-4},true);s.step(10,d.id)
    assert.ok(Math.abs(e.body.linvel().x)>normal*1.5);s.free()
  })
  test(`${d.id}: integration at 60 and 120 Hz gives comparable acceleration/braking`,()=>{
    const run=(dt:number)=>{
      const s=fleetFixture();s.place(d,0,0);const e=s.entry(d.id);s.world.timestep=dt
      inputState.forward=true
      for(let i=0;i<2/dt;i++){stepVehicle(e.sim,s.physics,e.body,inputState,true,dt,d);s.world.step()}
      const speed=s.speed(d.id);inputState.forward=false;inputState.backward=true
      for(let i=0;i<.5/dt;i++){stepVehicle(e.sim,s.physics,e.body,inputState,true,dt,d);s.world.step()}
      const brake=s.speed(d.id);s.free();return {speed,brake}
    }
    const a=run(1/60),b=run(1/120);assert.ok(Math.abs(a.speed-b.speed)<.1&&Math.abs(a.brake-b.brake)<.1)
  })
  test(`${d.id}: actual curb-cut braking turns stay grounded, upright and collidable`,()=>{
    const s=fleetFixture(true)
    for(const cut of DRIVEWAYS){
      const z=(cut.crossing.minZ+cut.crossing.maxZ)/2
      s.place(d,cut.center,z+5);inputState.forward=true;s.step(65,d.id)
      inputState.left=inputState.backward=true;inputState.forward=false;s.step(30,d.id)
      const e=s.entry(d.id),p=e.body.translation()
      assert.ok(p.y>.1&&p.y<d.rideHeight+.5&&vehicleUp(e.body)>.999)
    }
    s.free()
  })
  test(`${d.id}: support and all chassis shapes validated against real city at spawn`,()=>{
    const s=fleetFixture(true),e=s.entry(d.id)
    s.step(1)
    assert.ok(safeRecoveryPose(s.physics,e.body,d,{...d.spawn,yaw:d.spawnYaw}))
    assert.equal(safeRecoveryPose(s.physics,e.body,d,{x:0,y:50,z:0,yaw:0}),null)
    assert.equal(safeRecoveryPose(s.physics,e.body,d,{x:Infinity,y:0,z:0,yaw:0}),null)
    s.free()
  })
  test(`${d.id}: sustained overturn + one-second hold restores last safe pose only`,()=>{
    const s=fleetFixture(true);s.place(d,0,0);const e=s.entry(d.id),r=createRecoveryState()
    useVehicleStore.getState().setDriving(true,d.id)
    const tick=(n:number)=>{for(let i=0;i<n;i++)stepRecovery(r,s.physics,e.body,d,e.sim,true,FIXED_DT)}
    tick(35);assert.ok(r.lastSafe)
    const old={...r.lastSafe},others=VEHICLES.filter(v=>v.id!==d.id).map(v=>({...s.entry(v.id).body.translation()}))
    e.body.setTranslation({x:8,y:1,z:0},true);e.body.setRotation({x:1,y:0,z:0,w:0},true);s.world.step()
    assert.ok(vehicleUp(e.body)<-.99);tick(35);assert.equal(r.eligible,false)
    tick(3);assert.ok(r.eligible);inputState.recoveryHeld=true;tick(59)
    assert.ok(vehicleUp(e.body)<0);tick(2)
    const p=e.body.translation();assert.ok(vehicleUp(e.body)>.999&&Math.hypot(p.x-old.x,p.z-old.z)<.001)
    assert.ok(Math.hypot(e.body.linvel().x,e.body.linvel().y,e.body.linvel().z)<.001&&Math.hypot(e.body.angvel().x,e.body.angvel().y,e.body.angvel().z)<.001)
    assert.ok(!inputState.recoveryHeld&&!inputState.forward&&!inputState.jumpHeld)
    assert.ok(useVehicleStore.getState().driving&&useVehicleStore.getState().activeVehicleId===d.id)
    assert.ok(getVehicleRuntime(d.id).state.recoveryRevision>0)
    assert.ok(VEHICLES.filter(v=>v.id!==d.id).every((v,i)=>{const p=s.entry(v.id).body.translation();return Math.hypot(p.x-others[i].x,p.z-others[i].z)<.001}))
    s.free()
  })
}

test('normal driving, parking, handbrake, or walking cannot use R as teleport',()=>{
  const s=fleetFixture();s.place(COUPE,0,0);const e=s.entry(COUPE.id),r=createRecoveryState()
  inputState.recoveryHeld=true
  for(let i=0;i<300;i++)stepRecovery(r,s.physics,e.body,COUPE,e.sim,true,FIXED_DT)
  assert.ok(!r.eligible&&e.body.translation().x===0)
  inputState.forward=inputState.jumpHeld=true
  for(let i=0;i<300;i++)stepRecovery(r,s.physics,e.body,COUPE,e.sim,true,FIXED_DT)
  assert.ok(!r.eligible)
  e.body.setRotation({x:1,y:0,z:0,w:0},true)
  for(let i=0;i<300;i++)stepRecovery(r,s.physics,e.body,COUPE,e.sim,false,FIXED_DT)
  assert.ok(!r.eligible&&vehicleUp(e.body)<0);s.free()
})
test('airborne falling is not classified as stationary stuck or settled overturned',()=>{
  const s=fleetFixture();s.place(COUPE,0,0);const e=s.entry(COUPE.id),r=createRecoveryState()
  e.body.setTranslation({x:0,y:20,z:0},true);e.body.setLinvel({x:0,y:-8,z:0},true)
  inputState.forward=inputState.recoveryHeld=true
  for(let i=0;i<300;i++)stepRecovery(r,s.physics,e.body,COUPE,e.sim,true,FIXED_DT)
  assert.ok(!r.eligible&&e.body.translation().y===20);s.free()
})
test('real wall blockage gives a short throttle-release window; moving away cancels it',()=>{
  const s=fleetFixture();s.place(COUPE,0,0);const e=s.entry(COUPE.id),r=createRecoveryState()
  s.world.createCollider(RAPIER.ColliderDesc.cuboid(5,2,.25).setTranslation(0,2,-3))
  inputState.forward=true
  for(let i=0;i<300;i++){stepRecovery(r,s.physics,e.body,COUPE,e.sim,true,FIXED_DT);s.step(1,COUPE.id)}
  assert.ok(r.eligible&&r.blocked>=3)
  inputState.forward=false;stepRecovery(r,s.physics,e.body,COUPE,e.sim,true,FIXED_DT);assert.ok(r.eligible)
  // Window permits a complete R hold without requiring throttle, then expires.
  for(let i=0;i<70;i++)stepRecovery(r,s.physics,e.body,COUPE,e.sim,true,FIXED_DT)
  assert.ok(r.eligible)
  e.body.setLinvel({x:2,y:0,z:0},true);stepRecovery(r,s.physics,e.body,COUPE,e.sim,true,FIXED_DT);assert.equal(r.eligible,false)
  r.stuckGrace=1;e.body.setLinvel({x:0,y:0,z:0},true)
  for(let i=0;i<70;i++)stepRecovery(r,s.physics,e.body,COUPE,e.sim,true,FIXED_DT)
  assert.equal(r.eligible,false)
  s.free()
})
test('other vehicle blocks checkpoint; safe original spawn is validated as fallback',()=>{
  const s=fleetFixture(true);s.place(COUPE,0,0);const e=s.entry(COUPE.id),r=createRecoveryState()
  r.lastSafe={x:0,y:.53,z:0,yaw:0}
  s.entry('city-sedan').body.setTranslation({x:0,y:.58,z:0},true)
  e.body.setTranslation({x:8,y:1,z:0},true);e.body.setRotation({x:1,y:0,z:0,w:0},true);s.world.step()
  assert.equal(safeRecoveryPose(s.physics,e.body,COUPE,r.lastSafe),null)
  r.overturned=1;inputState.recoveryHeld=true
  for(let i=0;i<61;i++)stepRecovery(r,s.physics,e.body,COUPE,e.sim,true,FIXED_DT)
  assert.ok(Math.hypot(e.body.translation().x-COUPE.spawn.x,e.body.translation().z-COUPE.spawn.z)<.001);s.free()
})
test('blocked checkpoint and spawn fail safely without moving vehicle or resetting active ID',()=>{
  const s=fleetFixture(true);s.place(COUPE,0,0);const e=s.entry(COUPE.id),r=createRecoveryState()
  r.lastSafe={x:0,y:.53,z:0,yaw:0}
  for(const p of [{x:0,z:0},COUPE.spawn])s.world.createCollider(RAPIER.ColliderDesc.cuboid(3,2,3).setTranslation(p.x,2,p.z))
  e.body.setTranslation({x:8,y:1,z:0},true);e.body.setRotation({x:1,y:0,z:0,w:0},true);s.world.step()
  useVehicleStore.getState().setDriving(true,COUPE.id);r.overturned=1;inputState.recoveryHeld=true
  const before=e.body.translation()
  for(let i=0;i<61;i++)stepRecovery(r,s.physics,e.body,COUPE,e.sim,true,FIXED_DT)
  assert.deepEqual(e.body.translation(),before);assert.ok(useVehicleStore.getState().recoveryHint.includes('blocked'))
  assert.equal(useVehicleStore.getState().activeVehicleId,COUPE.id);s.free()
})
test('release of R cancels partial recovery hold and requires another full second',()=>{
  const s=fleetFixture();s.place(COUPE,0,0);const e=s.entry(COUPE.id),r=createRecoveryState()
  e.body.setRotation({x:1,y:0,z:0,w:0},true);r.overturned=1;inputState.recoveryHeld=true
  for(let i=0;i<35;i++)stepRecovery(r,s.physics,e.body,COUPE,e.sim,true,FIXED_DT)
  inputState.recoveryHeld=false;stepRecovery(r,s.physics,e.body,COUPE,e.sim,true,FIXED_DT);assert.equal(r.held,0)
  inputState.recoveryHeld=true
  for(let i=0;i<35;i++)stepRecovery(r,s.physics,e.body,COUPE,e.sim,true,FIXED_DT)
  assert.ok(vehicleUp(e.body)<0);s.free()
})
test('brake/reverse signals use motion and pedal direction, including W braking reverse',()=>{
  resetInput();inputState.backward=true
  assert.deepEqual(vehicleSignals(10,inputState,true),{braking:true,reversing:false})
  assert.deepEqual(vehicleSignals(-3,inputState,true),{braking:false,reversing:true})
  inputState.backward=false;inputState.forward=true
  assert.deepEqual(vehicleSignals(-3,inputState,true),{braking:true,reversing:true})
  assert.deepEqual(vehicleSignals(3,inputState,true),{braking:false,reversing:false})
  inputState.jumpHeld=true
  assert.deepEqual(vehicleSignals(3,inputState,true),{braking:true,reversing:false})
  assert.deepEqual(vehicleSignals(-3,inputState,false),{braking:false,reversing:false})
  resetInput();assert.deepEqual(vehicleSignals(0,inputState,true),{braking:false,reversing:false})
})
console.log(`ALL PASS (${count} driving polish groups)`)
