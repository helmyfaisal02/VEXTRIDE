import assert from 'node:assert/strict'
import RAPIER from '@dimforge/rapier3d-compat'
import { MISSIONS,FIRST_CONTACT,objectiveNPC } from '../src/game/missions/missionDefinitions'
import { initialMissionProgress,reduceMission,currentObjective,useMissionStore } from '../src/game/missions/missionState'
import { acceptMission,declineMission,acknowledgeObjective } from '../src/game/missions/missionManager'
import { missionHUD,missionTarget,targetReadout } from '../src/game/missions/missionPresentation'
import { NPCS,npcHeight } from '../src/game/npcs/npcConfig'
import { npcRegistry } from '../src/game/npcs/npcState'
import { useDialogueStore } from '../src/game/interactions/dialogueState'
import { processInteraction } from '../src/game/interactions/interactionCoordinator'
import { inputState } from '../src/game/input/inputState'
import { useVehicleStore,vehicleRuntime } from '../src/game/vehicles/vehicleState'
import { useCharacterStore } from '../src/game/state/characterStore'
import { VEHICLES } from '../src/game/vehicles/vehicleConfig'
import { fleetFixture } from './vehicle-fleet-fixture'
await RAPIER.init()
let count=0
function test(name:string,run:()=>void){run();count++;console.log(`PASS  ${name}`)}
function fixture(){
 const f=fleetFixture(true),r=f.physics.rapier
 useCharacterStore.getState().setName('Mission Test');useCharacterStore.getState().confirm()
 // Fixture reset only; production has no restart/reset action or persistence.
 useMissionStore.setState({progress:initialMissionProgress(),completionNotice:false});useDialogueStore.getState().close()
 for(const d of NPCS){const h=npcHeight(d),b=f.world.createRigidBody(r.RigidBodyDesc.fixed().setTranslation(d.spawn.x,d.spawn.y,d.spawn.z));f.world.createCollider(r.ColliderDesc.capsule(h/2-d.radius,d.radius).setTranslation(0,h/2,0),b);npcRegistry.set(d.id,{definition:d,body:b})}
 const player=f.world.createRigidBody(r.RigidBodyDesc.dynamic().setTranslation(0,1,0).lockRotations());f.world.createCollider(r.ColliderDesc.capsule(.6,.3),player);vehicleRuntime.pedestrian=player
 const talk=(id:'maya'|'marcus')=>{useDialogueStore.getState().close();const d=NPCS.find(d=>d.id===id)!;player.setTranslation({x:d.spawn.x-2,y:d.spawn.y+.9,z:d.spawn.z},true);player.setLinvel({x:0,y:0,z:0},true);f.world.step();inputState.interactQueued=true;processInteraction(f.physics);assert.equal(useDialogueStore.getState().active?.id,id);return useDialogueStore.getState().session}
 const free=()=>{useDialogueStore.getState().close();npcRegistry.clear();vehicleRuntime.pedestrian=null;f.free()}
 return {...f,player,talk,free}
}
const acceptEvent={kind:'accept' as const,missionId:FIRST_CONTACT.id,npcId:'maya' as const,session:1}
const marcusEvent={kind:'acknowledge' as const,missionId:FIRST_CONTACT.id,npcId:'marcus' as const,objectiveId:'meet-marcus' as const,session:2}
const mayaEvent={kind:'acknowledge' as const,missionId:FIRST_CONTACT.id,npcId:'maya' as const,objectiveId:'return-to-maya' as const,session:3}
test('exactly one definition, two unique valid talk objectives, actual NPC metadata targets',()=>{
 assert.equal(MISSIONS.length,1);assert.equal(FIRST_CONTACT.title,'First Contact');assert.equal(FIRST_CONTACT.id,'first-contact')
 assert.equal(new Set(FIRST_CONTACT.objectives.map(o=>o.id)).size,2)
 assert.deepEqual(FIRST_CONTACT.objectives.map(o=>o.npcId),['marcus','maya'])
 for(const o of FIRST_CONTACT.objectives){assert.ok(NPCS.includes(objectiveNPC(o)));assert.ok(o.text.length>10&&o.acknowledgement.length>30&&o.action.length>5)}
})
test('acceptance is required; wrong giver and premature objective acknowledgements are ignored',()=>{
 const p=initialMissionProgress()
 assert.equal(reduceMission(p,marcusEvent),p);assert.equal(reduceMission(p,mayaEvent),p)
 assert.equal(reduceMission(p,{...acceptEvent,npcId:'marcus'}),p)
 const accepted=reduceMission(p,acceptEvent);assert.equal(accepted.status,'ACTIVE');assert.equal(accepted.objectiveId,'meet-marcus')
})
test('explicit ordered acknowledgements progress Marcus -> Maya -> completed only once',()=>{
 const active=reduceMission(initialMissionProgress(),acceptEvent)
 assert.equal(reduceMission(active,mayaEvent),active)
 assert.equal(reduceMission(active,{...marcusEvent,npcId:'maya'}),active)
 const returning=reduceMission(active,marcusEvent);assert.equal(returning.status,'ACTIVE');assert.equal(returning.objectiveId,'return-to-maya')
 assert.equal(reduceMission(returning,marcusEvent),returning)
 const done=reduceMission(returning,mayaEvent);assert.equal(done.status,'COMPLETED');assert.equal(done.objectiveId,null)
 assert.equal(reduceMission(done,mayaEvent),done);assert.equal(reduceMission(done,{...acceptEvent,session:4}),done)
})
test('duplicate, nonfinite and stale dialogue sessions cannot skip objectives',()=>{
 const active=reduceMission(initialMissionProgress(),acceptEvent)
 for(const session of[1,0,-1,NaN,Infinity,1.5])assert.equal(reduceMission(active,{...marcusEvent,session}),active)
 const returning=reduceMission(active,marcusEvent)
 assert.equal(reduceMission(returning,{...mayaEvent,session:2}),returning)
})
test('HUD/waypoint select real Marcus then Maya and disappear after completion',()=>{
 const initial=initialMissionProgress();assert.equal(missionHUD(initial),null);assert.equal(missionTarget(initial),null)
 const active=reduceMission(initial,acceptEvent);assert.equal(missionTarget(active),NPCS[0]);assert.equal(missionHUD(active)!.objective,'Talk to Marcus at Motor Row.')
 const returning=reduceMission(active,marcusEvent);assert.equal(missionTarget(returning),NPCS[1]);assert.equal(missionHUD(returning)!.objective,'Return to Maya at Central Plaza.')
 const done=reduceMission(returning,mayaEvent);assert.equal(missionHUD(done),null);assert.equal(missionTarget(done),null);assert.equal(currentObjective(done),undefined)
})
test('compass and distance are explicitly straight-line and work independently of travel mode',()=>{
 assert.equal(targetReadout({x:0,z:0},{x:0,z:-10}),'N · 10 m straight-line')
 assert.equal(targetReadout({x:0,z:0},{x:10,z:0}),'E · 10 m straight-line')
 assert.equal(targetReadout({x:0,z:0},{x:10,z:10}),'SE · 14 m straight-line')
})
test('real Maya E conversation alone, normal Continue/Close and decline never start a mission',()=>{
 const f=fixture();let session=f.talk('maya');assert.equal(useMissionStore.getState().progress.status,'NOT_STARTED')
 useDialogueStore.getState().advance();useDialogueStore.getState().advance();useDialogueStore.getState().advance();assert.equal(useMissionStore.getState().progress.status,'NOT_STARTED')
 session=f.talk('maya');assert.ok(declineMission(session));assert.equal(useMissionStore.getState().progress.status,'NOT_STARTED');assert.equal(useDialogueStore.getState().active,null)
 assert.ok(acceptMission(f.talk('maya')));f.free()
})
test('explicit accept through actual Maya interaction activates once and resets held inputs',()=>{
 const f=fixture(),session=f.talk('maya');inputState.forward=inputState.interactQueued=true
 assert.ok(acceptMission(session));assert.ok(!acceptMission(session));assert.ok(Object.values(inputState).every(v=>!v))
 assert.equal(useDialogueStore.getState().active,null);assert.equal(useMissionStore.getState().progress.objectiveId,'meet-marcus');f.free()
})
test('correct Marcus conversation does not progress until acknowledged; early close is safe',()=>{
 const f=fixture();assert.ok(acceptMission(f.talk('maya')))
 const first=f.talk('marcus');assert.equal(useMissionStore.getState().progress.objectiveId,'meet-marcus');useDialogueStore.getState().close()
 assert.ok(!acknowledgeObjective('meet-marcus',first));const second=f.talk('marcus')
 assert.ok(!acknowledgeObjective('meet-marcus',first));assert.ok(acknowledgeObjective('meet-marcus',second));assert.ok(!acknowledgeObjective('meet-marcus',second))
 assert.equal(useMissionStore.getState().progress.objectiveId,'return-to-maya');f.free()
})
test('Maya cannot finish early; final acknowledgement completes once with no rewards or restart',()=>{
 const f=fixture();assert.ok(acceptMission(f.talk('maya')))
 assert.ok(!acknowledgeObjective('return-to-maya',f.talk('maya')))
 assert.ok(acknowledgeObjective('meet-marcus',f.talk('marcus')))
 const session=f.talk('maya');useDialogueStore.getState().close();assert.equal(useMissionStore.getState().progress.status,'ACTIVE')
 assert.ok(!acknowledgeObjective('return-to-maya',session));assert.ok(acknowledgeObjective('return-to-maya',f.talk('maya')))
 assert.equal(useMissionStore.getState().progress.status,'COMPLETED');assert.ok(useMissionStore.getState().completionNotice)
 useMissionStore.getState().dismissCompletion();assert.ok(!useMissionStore.getState().completionNotice)
 assert.ok(!acceptMission(f.talk('maya')));assert.ok(!acknowledgeObjective('return-to-maya',useDialogueStore.getState().session));assert.ok(!useMissionStore.getState().completionNotice);f.free()
})
test('wrong NPC, missing body, stale session and remote dialogue cannot accept or acknowledge',()=>{
 const f=fixture();assert.ok(!acceptMission(f.talk('marcus')))
 const session=f.talk('maya');f.player.setTranslation({x:0,y:1,z:0},true);assert.ok(!acceptMission(session))
 f.talk('maya');assert.ok(!acceptMission(session));const current=useDialogueStore.getState().session
 const maya=npcRegistry.get('maya')!;npcRegistry.delete('maya');assert.ok(!acceptMission(current));npcRegistry.set('maya',maya)
 assert.ok(acceptMission(current));assert.ok(!acknowledgeObjective('meet-marcus',f.talk('maya')));f.free()
})
test('all three driving modes and creator state refuse conversation progression without corrupting mission',()=>{
 const f=fixture();assert.ok(acceptMission(f.talk('maya')));const session=f.talk('marcus'),progress=useMissionStore.getState().progress
 for(const d of VEHICLES){useVehicleStore.getState().setDriving(true,d.id);assert.ok(!acknowledgeObjective('meet-marcus',session));assert.equal(useMissionStore.getState().progress,progress);useVehicleStore.getState().setDriving(false)}
 useCharacterStore.getState().openMenu();assert.ok(!acknowledgeObjective('meet-marcus',session));assert.equal(useMissionStore.getState().progress,progress);useCharacterStore.getState().cancel();f.free()
})
test('ordinary NPC lines and dialogue progression remain intact after mission completion',()=>{
 const snapshots=NPCS.map(n=>[...n.lines]),f=fixture();acceptMission(f.talk('maya'));acknowledgeObjective('meet-marcus',f.talk('marcus'));acknowledgeObjective('return-to-maya',f.talk('maya'))
 for(const d of NPCS){f.talk(d.id);for(let i=0;i<3;i++){assert.equal(useDialogueStore.getState().line,i);assert.equal(useDialogueStore.getState().active!.lines[i],snapshots[NPCS.indexOf(d)][i]);useDialogueStore.getState().advance()}assert.equal(useDialogueStore.getState().active,null)}
 assert.deepEqual(NPCS.map(n=>[...n.lines]),snapshots);f.free()
})
console.log(`ALL PASS (${count} mission groups)`)
