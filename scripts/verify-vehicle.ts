import assert from 'node:assert/strict'
import RAPIER from '@dimforge/rapier3d-compat'
import { COUPE, WHEELS, CHASSIS_COLLIDERS } from '../src/game/vehicles/vehicleConfig'
import { bodyYaw, createVehicleSim, stepVehicle } from '../src/game/vehicles/vehicleSim'
import { canEnter, findVehicleExit, processVehicleInteraction } from '../src/game/vehicles/vehicleInteraction'
import { useVehicleStore, vehicleRuntime } from '../src/game/vehicles/vehicleState'
import { inputState, resetInput } from '../src/game/input/inputState'
import { CITY } from '../src/game/city/cityLayout'
import { DRIVEWAYS } from '../src/game/city/driveways'
import { buildSidewalkGeometry } from '../src/game/city/sidewalkGeometry'
import { ENVIRONMENT } from '../src/game/environment/envLayout'
import { FEET_OFFSET, CAPSULE_HALF_SEGMENT, CAPSULE_RADIUS, FIXED_DT } from '../src/game/character/config'
import { surfaceHeightAt } from '../src/game/city/citySurface'
import { createCoupeAssets } from '../src/game/vehicles/coupeGeometry'
import { selectActiveCamera } from '../src/game/camera/CameraDirector'

await RAPIER.init()
let count = 0
function test(name: string, run: () => void) { run(); count++; console.log(`PASS  ${name}`) }
function setup(city = false) {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
  const physics = { world, rapier: RAPIER }
  const box = (r: { minX: number; maxX: number; minZ: number; maxZ: number }, top: number, bottom = 0) => world.createCollider(RAPIER.ColliderDesc.cuboid((r.maxX-r.minX)/2,(top-bottom)/2,(r.maxZ-r.minZ)/2).setTranslation((r.minX+r.maxX)/2,(top+bottom)/2,(r.minZ+r.maxZ)/2))
  if (city) {
    box(CITY.floor,.03)
    for (const s of CITY.sidewalks) {
      if (DRIVEWAYS.some((d) => d.sidewalkId === s.id)) {
        const g = buildSidewalkGeometry(s,CITY.blocks.find((b)=>b.id===s.blockId)!.rect)
        world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(g.getAttribute('position').array),new Uint32Array(g.getIndex()!.array)))
        g.dispose()
      } else box(s.rect,s.top)
    }
    for (const c of ENVIRONMENT.colliders) box(c.rect,c.y1,c.y0)
  } else box({minX:-500,maxX:500,minZ:-500,maxZ:500},.03,-1)
  const car = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0,.55,0).enabledRotations(false,true,false).setCcdEnabled(true).setAngularDamping(2))
  for (const c of CHASSIS_COLLIDERS) world.createCollider(RAPIER.ColliderDesc.cuboid(...c.half).setTranslation(...c.position).setMass(c.mass).setFriction(.05).setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min),car)
  for (const w of WHEELS) world.createCollider(RAPIER.ColliderDesc.ball(.28).setTranslation(Math.sign(w.x)*.64,-.22,w.z).setMass(25).setFriction(.05).setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min),car)
  let sim = createVehicleSim(RAPIER)
  const step = (n: number, driving = true) => { for(let i=0;i<n;i++){stepVehicle(sim,physics,car,inputState,driving,FIXED_DT);world.step()} }
  const place = (x:number,z:number,yaw=0) => {
    resetInput();car.setTranslation({x,y:surfaceHeightAt(x,z)+.52,z},true)
    car.setRotation({x:0,y:Math.sin(yaw/2),z:0,w:Math.cos(yaw/2)},true)
    car.setLinvel({x:0,y:0,z:0},true);car.setAngvel({x:0,y:0,z:0},true)
    sim=createVehicleSim(RAPIER);world.step();step(90,false)
  }
  const speed=()=>{const v=car.linvel(),yaw=bodyYaw(car);return -Math.sin(yaw)*v.x-Math.cos(yaw)*v.z}
  return {world,physics,car,step,place,speed,get sim(){return sim}}
}

test('original procedural coupe has finite geometry, four wheels and a 1.4 m visual height',()=>{
  const a=createCoupeAssets()
  assert.equal(WHEELS.length,4);assert.equal(WHEELS.filter(w=>w.front).length,2)
  a.geometries.body.computeBoundingBox()
  assert.ok(Math.abs(a.geometries.body.boundingBox!.max.y+.5-COUPE.height)<.0001)
  for(const g of Object.values(a.geometries)){assert.ok(Array.from(g.getAttribute('position').array).every(Number.isFinite));g.dispose()}
  Object.values(a.materials).forEach(m=>m.dispose())
})
test('fixed-step forward acceleration and 22 m/s cap; no sideways drift on straight road',()=>{
  const s=setup();s.place(0,0);inputState.forward=true;s.step(360)
  assert.ok(s.speed()>21&&s.speed()<=22.01);assert.ok(Math.abs(s.car.linvel().x)<.001)
  assert.ok(s.sim.grounded);assert.ok(Math.abs(s.car.translation().y-.53)<.025);s.world.free()
})
test('active brake is stronger than coasting; handbrake stops the chassis',()=>{
  const s=setup();s.place(0,0);inputState.forward=true;s.step(180);const start=s.speed()
  resetInput();s.step(60);const coast=start-s.speed()
  s.place(0,0);inputState.forward=true;s.step(180);resetInput();inputState.backward=true;s.step(60)
  assert.ok(start-s.speed()>coast*3)
  inputState.backward=false;inputState.jumpHeld=true;s.step(120);assert.ok(Math.abs(s.speed())<.15);s.world.free()
})
test('S brakes forward travel before reversing; reverse is capped at 7 m/s',()=>{
  const s=setup();s.place(0,0);inputState.forward=true;s.step(120);resetInput();inputState.backward=true
  s.step(20);assert.ok(s.speed()>0)
  s.step(250);assert.ok(s.speed()< -6.5&&s.speed()>=-7.01);s.world.free()
})
test('steering is speed-dependent, reverses direction in reverse, and stays upright',()=>{
  const s=setup();s.place(0,0);inputState.forward=true;s.step(60);inputState.left=true;s.step(60)
  assert.ok(bodyYaw(s.car)>.3);assert.ok(s.sim.steering>.4)
  assert.ok(Math.abs(s.car.rotation().x)+Math.abs(s.car.rotation().z)<.0001)
  s.place(0,0);inputState.backward=true;inputState.left=true;s.step(120);assert.ok(bodyYaw(s.car)<-.2);s.world.free()
})
test('wheel travel comes from resolved chassis movement; reverse changes roll direction',()=>{
  const s=setup();s.place(0,0);inputState.forward=true;s.step(120);assert.ok(s.sim.roll< -5)
  s.place(0,0);inputState.backward=true;s.step(120);assert.ok(s.sim.roll>5)
  resetInput();s.step(180,false);const roll=s.sim.roll;s.step(60,false);assert.ok(Math.abs(s.sim.roll-roll)<.05);s.world.free()
})
test('driver inputs are ignored while parked, and control-mode changes clear held/queued keys',()=>{
  const s=setup();s.place(0,0);inputState.forward=true;inputState.left=true;inputState.jumpQueued=true;s.step(120,false)
  assert.ok(Math.hypot(s.car.translation().x,s.car.translation().z)<.02)
  useVehicleStore.getState().setDriving(true)
  assert.ok(Object.values(inputState).every(v=>v===false));useVehicleStore.getState().setDriving(false);s.world.free()
})
test('physics results agree at 30/60/144 render FPS with the existing fixed 60 Hz step',()=>{
  const results=[]
  for(const fps of [30,60,144]){
    const s=setup();s.place(0,0);inputState.forward=true;let accumulator=0
    for(let frame=0;frame<fps*3;frame++){accumulator+=1/fps;while(accumulator+1e-9>=FIXED_DT){s.step(1);accumulator-=FIXED_DT}}
    results.push(s.car.translation().z);s.world.free()
  }
  assert.ok(Math.max(...results)-Math.min(...results)<.0001)
})
const city=setup(true)
test('designated Motor Row parking spawn is clear of all existing static objects',()=>{
  city.car.setTranslation(COUPE.spawn,true)
  city.car.setRotation({x:0,y:Math.sin(COUPE.spawnYaw/2),z:0,w:Math.cos(COUPE.spawnYaw/2)},true)
  city.world.step()
  for(let i=0;i<city.car.numColliders();i++){
    const c=city.car.collider(i)
    assert.equal(city.world.intersectionWithShape(c.translation(),c.rotation(),c.shape,RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,undefined,undefined,city.car),null)
  }
})
test('vehicle stops against the actual garage facade; wheel animation stops when pushing a wall',()=>{
  city.place(102.2,-88,0);inputState.forward=true;city.step(240)
  assert.ok(city.car.translation().z>-92.0&&city.car.translation().z<-91.5)
  const roll=city.sim.roll;city.step(60);assert.ok(Math.abs(city.sim.roll-roll)<.15)
})
test('vehicle collides with a substantial container using its existing environment dimensions',()=>{
  const s=setup(),c=ENVIRONMENT.colliders.find(c=>c.id.startsWith('container-'))!
  const r=c.rect
  s.world.createCollider(RAPIER.ColliderDesc.cuboid((r.maxX-r.minX)/2,(c.y1-c.y0)/2,(r.maxZ-r.minZ)/2).setTranslation((r.minX+r.maxX)/2,(c.y0+c.y1)/2,(r.minZ+r.maxZ)/2))
  s.world.step();s.place((r.minX+r.maxX)/2,r.maxZ+4)
  inputState.forward=true;s.step(180)
  assert.ok(s.car.translation().z>=r.maxZ+2.0&&s.car.translation().z<r.maxZ+3)
  s.world.free()
})
test('all 40 real road segments support grounded upright driving in existing right-hand lanes',()=>{
  for(const road of CITY.roads){
    const lane=CITY.laneEdges.find(l=>l.roadId===road.id)!
    const x=lane.start.x+(lane.end.x-lane.start.x)*.25,z=lane.start.z+(lane.end.z-lane.start.z)*.25
    city.place(x,z,Math.atan2(-lane.dir.x,-lane.dir.z));inputState.forward=true;city.step(100)
    assert.ok(Math.hypot(city.car.translation().x-x,city.car.translation().z-z)>8,`${road.id}: moved ${Math.hypot(city.car.translation().x-x,city.car.translation().z-z)} m; speed ${city.speed()}; grounded ${city.sim.grounded}`)
    assert.ok(Math.abs(city.car.translation().y-.53)<.04,road.id)
  }
})
test('existing 0.13 m uncut curb does not launch or roll the grounded chassis',()=>{
  city.place(78,-40,-Math.PI/2);city.car.setLinvel({x:10,y:0,z:0},true)
  inputState.forward=true;let highest=0
  for(let i=0;i<120;i++){city.step(1);highest=Math.max(highest,city.car.translation().y)}
  assert.ok(city.car.translation().x>90)
  assert.ok(highest<.9,`maximum chassis centre height ${highest}`)
  assert.ok(Math.abs(city.car.rotation().x)+Math.abs(city.car.rotation().z)<.0001)
})
for(const junction of [CITY.junctions.find(j=>j.x===0&&j.z===0)!,CITY.junctions.find(j=>j.x===0&&j.z===-160)!])test(`arcade left turn through actual ${junction.type} junction ${junction.id}`,()=>{
  city.place(junction.x+3.5,junction.z+1,0)
  city.car.setLinvel({x:0,y:0,z:-5},true)
  let turned=false,maxHeight=0
  for(let i=0;i<200;i++){
    inputState.forward=city.speed()<5
    inputState.left=!turned
    if(bodyYaw(city.car)>=Math.PI/2-.01)turned=true
    city.step(1);maxHeight=Math.max(maxHeight,city.car.translation().y)
  }
  resetInput()
  assert.ok(turned&&city.car.translation().x<junction.x-7)
  assert.ok(Math.abs(city.car.translation().z-junction.z)<6.5&&maxHeight<.62)
})
for(const cut of DRIVEWAYS)test(`${cut.id}: real chassis traverses the Phase 2.4 curb cut`,()=>{
  const edge=cut.side==='S'?cut.crossing.maxZ:cut.crossing.minZ
  city.place(cut.center,edge+(cut.side==='S'?4:-4),cut.side==='S'?0:Math.PI)
  inputState.forward=true;city.step(150)
  assert.ok(cut.side==='S'?city.car.translation().z<edge-2.2:city.car.translation().z>edge+2.2)
  assert.ok(city.car.translation().y>.48&&city.car.translation().y<.60)
})
city.world.free()
test('entry/exit uses real bodies, clear ground, speed gating and blocked-exit protection',()=>{
  const s=setup();s.place(0,0)
  const player=s.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(-2,.03+FEET_OFFSET+.04,0))
  s.world.createCollider(RAPIER.ColliderDesc.capsule(CAPSULE_HALF_SEGMENT,CAPSULE_RADIUS),player);s.world.step()
  vehicleRuntime.body=s.car;vehicleRuntime.pedestrian=player
  assert.ok(canEnter(s.physics,s.car,player));inputState.interactQueued=true;inputState.forward=true
  processVehicleInteraction(s.physics)
  assert.ok(useVehicleStore.getState().driving&&!player.isEnabled()&&!inputState.forward)
  s.car.setLinvel({x:0,y:0,z:-5},true);inputState.interactQueued=true;processVehicleInteraction(s.physics)
  assert.ok(useVehicleStore.getState().driving&&useVehicleStore.getState().hint.includes('Brake'))
  s.car.setLinvel({x:0,y:0,z:0},true)
  processVehicleInteraction(s.physics)
  assert.equal(useVehicleStore.getState().hint,'')
  const walls=[[-1.7,0,.3,4],[1.7,0,.3,4],[0,3,4,.3],[0,-3,4,.3]].map(([x,z,hx,hz])=>s.world.createCollider(RAPIER.ColliderDesc.cuboid(hx,2,hz).setTranslation(x,1,z)))
  s.world.step();assert.equal(findVehicleExit(s.physics,s.car,player),null)
  inputState.interactQueued=true;processVehicleInteraction(s.physics);assert.ok(useVehicleStore.getState().driving&&useVehicleStore.getState().hint.includes('blocked'))
  walls.forEach(w=>s.world.removeCollider(w,false));s.world.step()
  const exit=findVehicleExit(s.physics,s.car,player);assert.ok(exit)
  const carPose=s.car.translation();inputState.interactQueued=true;inputState.jumpHeld=true;processVehicleInteraction(s.physics)
  assert.ok(!useVehicleStore.getState().driving&&player.isEnabled()&&!inputState.jumpHeld)
  assert.deepEqual(s.car.translation(),carPose)
  assert.equal(s.world.intersectionWithShape(player.translation(),player.rotation(),player.collider(0).shape,RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,undefined,undefined,player),null)
  vehicleRuntime.body=null;vehicleRuntime.pedestrian=null;s.world.free()
})
test('entry cannot reach through a building wall',()=>{
  const s=setup();s.place(0,0)
  const p=s.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(-2.5,1,0))
  s.world.createCollider(RAPIER.ColliderDesc.cuboid(.1,2,3).setTranslation(-1.4,1,0));s.world.step()
  assert.equal(canEnter(s.physics,s.car,p),false);s.world.free()
})
test('camera director selects exactly one camera and preserves creator/debug precedence',()=>{
  assert.equal(selectActiveCamera(false,'follow',true),'vehicle')
  assert.equal(selectActiveCamera(false,'orbit',true),'orbit')
  assert.equal(selectActiveCamera(true,'follow',true),'preview')
  assert.equal(selectActiveCamera(false,'follow',false),'follow')
})
resetInput()
console.log(`ALL PASS (${count} vehicle groups)`)
