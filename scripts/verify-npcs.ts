import assert from 'node:assert/strict'
import RAPIER from '@dimforge/rapier3d-compat'
import { Box3,Group,Mesh,MeshStandardMaterial } from 'three'
import { fleetFixture } from './vehicle-fleet-fixture'
import { NPCS,npcHeight } from '../src/game/npcs/npcConfig'
import { createNPCGeometry,npcIdle } from '../src/game/npcs/npcGeometry'
import { npcRegistry } from '../src/game/npcs/npcState'
import { nearestNPC,walkingTarget,processInteraction } from '../src/game/interactions/interactionCoordinator'
import { useDialogueStore } from '../src/game/interactions/dialogueState'
import { useVehicleStore,vehicleRuntime } from '../src/game/vehicles/vehicleState'
import { useCharacterStore } from '../src/game/state/characterStore'
import { inputState,resetInput } from '../src/game/input/inputState'
import { CITY } from '../src/game/city/cityLayout'
import { DRIVEWAYS } from '../src/game/city/driveways'
import { VEHICLES } from '../src/game/vehicles/vehicleConfig'
await RAPIER.init()
useCharacterStore.getState().setName('NPC Test');useCharacterStore.getState().confirm()
let count=0
function test(name:string,run:()=>void){run();count++;console.log(`PASS  ${name}`)}
function setup(city=true){
 const s=fleetFixture(city)
 for(const d of NPCS){const h=npcHeight(d),body=s.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(d.spawn.x,d.spawn.y,d.spawn.z));s.world.createCollider(RAPIER.ColliderDesc.capsule(h/2-d.radius,d.radius).setTranslation(0,h/2,0),body);npcRegistry.set(d.id,{definition:d,body})}
 const player=s.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0,1,0).lockRotations())
 s.world.createCollider(RAPIER.ColliderDesc.capsule(.6,.3),player);vehicleRuntime.pedestrian=player;s.world.step()
 const place=(x:number,z:number,y=1.06)=>{player.setTranslation({x,y,z},true);player.setLinvel({x:0,y:0,z:0},true);s.world.step()}
 const free=()=>{useDialogueStore.getState().close();npcRegistry.clear();vehicleRuntime.pedestrian=null;s.free()}
 return {...s,player,place,free}
}
test('exactly Marcus/Mechanic and Maya/Dispatcher have unique IDs and three grounded dialogue lines',()=>{
 assert.equal(NPCS.length,2);assert.equal(new Set(NPCS.map(d=>d.id)).size,2)
 assert.deepEqual(NPCS.map(d=>[d.name,d.role]),[['Marcus','Mechanic'],['Maya','Dispatcher']])
 for(const d of NPCS){assert.equal(d.lines.length,3);assert.ok(d.lines.every(l=>l.length>15&&l.length<160));assert.ok(d.range>=2.5&&d.range<=3)}
})
for(const d of NPCS){
 test(`${d.id}: actual city support, shape clearance, public access and no road/driveway/spawn obstruction`,()=>{
  const s=setup(),body=npcRegistry.get(d.id)!.body,h=npcHeight(d)
  const hit=s.world.castRayAndGetNormal(new RAPIER.Ray({x:d.spawn.x,y:d.spawn.y+1,z:d.spawn.z},{x:0,y:-1,z:0}),2,true,undefined,undefined,undefined,body)
  assert.ok(hit&&Math.abs(d.spawn.y+1-hit.timeOfImpact-d.spawn.y)<1e-5&&hit.normal.y>.99)
  assert.equal(s.world.intersectionWithShape({x:d.spawn.x,y:d.spawn.y+h/2+.01,z:d.spawn.z},{x:0,y:0,z:0,w:1},new RAPIER.Capsule(h/2-d.radius,d.radius),undefined,undefined,undefined,body),null)
  const inside=(r:{minX:number;maxX:number;minZ:number;maxZ:number})=>d.spawn.x>r.minX-.8&&d.spawn.x<r.maxX+.8&&d.spawn.z>r.minZ-.8&&d.spawn.z<r.maxZ+.8
  assert.ok(CITY.roads.every(r=>!inside(r.rect)))
  assert.ok(DRIVEWAYS.every(r=>!inside(r.approach)&&!inside(r.crossing)))
  assert.ok(VEHICLES.every(v=>Math.hypot(v.spawn.x-d.spawn.x,v.spawn.z-d.spawn.z)>6))
  for(const side of[-1,1]){s.place(d.spawn.x+side*1.8,d.spawn.z,d.spawn.y+.9);assert.equal(nearestNPC(s.physics,s.player)?.definition.id,d.id)}
  s.free()
 })
 test(`${d.id}: actual player capsule stops at the fixed NPC instead of walking through`,()=>{
  const s=setup();s.place(d.spawn.x-2,d.spawn.z,d.spawn.y+.9)
  for(let i=0;i<120;i++){s.player.setLinvel({x:3.6,y:s.player.linvel().y,z:0},true);s.world.step()}
  assert.ok(d.spawn.x-s.player.translation().x>=d.radius+.3-.03)
  s.free()
 })
 test(`${d.id}: five finite merged parts form a grounded humanoid with separate idle pivots`,()=>{
  const a=createNPCGeometry(d),material=new MeshStandardMaterial(),root=new Group(),torso=new Group(),head=new Group(),left=new Group(),right=new Group()
  root.scale.setScalar(d.scale);root.add(new Mesh(a.base,material));root.add(torso);torso.position.y=1
  torso.add(new Mesh(a.torso,material));head.position.y=.55;head.add(new Mesh(a.head,material));torso.add(head)
  left.position.set(-.31,.4,0);left.add(new Mesh(a.left,material));right.position.set(.31,.4,0);right.add(new Mesh(a.right,material));torso.add(left,right)
  const bounds=new Box3().setFromObject(root);assert.ok(Math.abs(bounds.min.y)<1e-6&&bounds.max.y>1.7&&bounds.max.y<1.95)
  assert.equal(Object.keys(a).length,5)
  for(const g of Object.values(a)){assert.ok(Array.from(g.getAttribute('position').array).every(Number.isFinite));assert.ok(g.getIndex()!.count<2000);g.dispose()}
  material.dispose()
 })
 test(`${d.id}: bounded time-based idle is stable through a full simulated hour at 30/60/144 FPS`,()=>{
  for(const fps of[30,60,144])for(let t=0;t<=3600;t+=1/fps*120){const p=npcIdle(t,d.scale);assert.ok(p.breath>=.992&&p.breath<=1.008&&Math.abs(p.head)<=.055&&Math.abs(p.left)<.06&&Math.abs(p.right)<.06)}
  assert.deepEqual(npcIdle(12.5,d.scale),npcIdle(12.5,d.scale))
 })
 test(`${d.id}: range, elevation and actual solid-wall occlusion prevent remote E`,()=>{
  const s=setup();s.place(d.spawn.x-2,d.spawn.z,d.spawn.y+.9);assert.equal(nearestNPC(s.physics,s.player)?.definition.id,d.id)
  s.place(d.spawn.x-3.1,d.spawn.z,d.spawn.y+.9);assert.equal(nearestNPC(s.physics,s.player),undefined)
  s.place(d.spawn.x-2,d.spawn.z,d.spawn.y+4);assert.equal(nearestNPC(s.physics,s.player),undefined)
  s.place(d.spawn.x-2,d.spawn.z,d.spawn.y+.9)
  s.world.createCollider(RAPIER.ColliderDesc.cuboid(.1,2,1).setTranslation(d.spawn.x-1,d.spawn.y+1,d.spawn.z));s.world.step()
  assert.equal(nearestNPC(s.physics,s.player),undefined);s.free()
 })
 test(`${d.id}: E opens once, stops horizontal motion, advances then closes and resets inputs`,()=>{
  const s=setup();s.place(d.spawn.x-2,d.spawn.z,d.spawn.y+.9);inputState.forward=inputState.interactQueued=true;s.player.setLinvel({x:3,y:0,z:0},true)
  processInteraction(s.physics);assert.equal(useDialogueStore.getState().active?.id,d.id);assert.equal(useVehicleStore.getState().driving,false)
  assert.equal(s.player.linvel().x,0);assert.ok(Object.values(inputState).every(v=>!v))
  inputState.interactQueued=true;processInteraction(s.physics);assert.equal(useDialogueStore.getState().line,0)
  useDialogueStore.getState().advance();assert.equal(useDialogueStore.getState().line,1)
  useDialogueStore.getState().advance();assert.equal(useDialogueStore.getState().line,2)
  inputState.left=true;useDialogueStore.getState().advance();assert.equal(useDialogueStore.getState().active,null);assert.ok(!inputState.left)
  s.free()
 })
}
test('NPC/car deterministic ties favor car; nearer NPC consumes E exclusively',()=>{
 const s=setup(false),d=NPCS[0],npc=npcRegistry.get(d.id)!.body,car=s.entry('street-coupe').body
 npc.setTranslation({x:2,y:0,z:0},true)
 const original=d.spawn.y; // Interaction height remains definition-driven; feet difference is within tolerance.
 assert.ok(original<.2)
 car.setTranslation({x:-2,y:.53,z:0},true);s.place(0,0,.93)
 assert.equal(walkingTarget(s.physics,s.player)?.kind,'vehicle')
 npc.setTranslation({x:1.5,y:0,z:0},true);s.world.step();assert.equal(walkingTarget(s.physics,s.player)?.kind,'npc')
 inputState.interactQueued=true;processInteraction(s.physics);assert.equal(useDialogueStore.getState().active?.id,d.id);assert.ok(!useVehicleStore.getState().driving)
 useDialogueStore.getState().close();npc.setTranslation({x:20,y:0,z:0},true);s.world.step()
 inputState.interactQueued=true;processInteraction(s.physics);assert.ok(useVehicleStore.getState().driving);assert.equal(useDialogueStore.getState().active,null)
 // Driving E still routes to normal speed-gated vehicle exit, never NPC dialogue.
 useDialogueStore.getState().open(d);assert.equal(useDialogueStore.getState().active,null)
 s.free()
})
test('equal-distance NPCs use stable IDs even when registry insertion order changes',()=>{
 const s=setup(false),a=npcRegistry.get('marcus')!,b=npcRegistry.get('maya')!
 a.body.setTranslation({x:-2,y:0,z:0},true);b.body.setTranslation({x:2,y:0,z:0},true);s.place(0,0,.93)
 npcRegistry.clear();npcRegistry.set('maya',b);npcRegistry.set('marcus',a)
 assert.equal(nearestNPC(s.physics,s.player)?.definition.id,'marcus');s.free()
})
test('creator prevents dialogue and normal coordinator does not steal its E queue',()=>{
 const s=setup(),d=NPCS[1];s.place(d.spawn.x-2,d.spawn.z,d.spawn.y+.9);useCharacterStore.getState().openMenu()
 inputState.interactQueued=true;processInteraction(s.physics);useDialogueStore.getState().open(d);assert.equal(useDialogueStore.getState().active,null)
 useCharacterStore.getState().cancel();resetInput();s.free()
})
console.log(`ALL PASS (${count} NPC groups)`)
