import assert from 'node:assert/strict'
import RAPIER from '@dimforge/rapier3d-compat'
import { Color } from 'three'
import { economyFixture } from './economy-fixture'
import { STREET_CASH,MISSION_REWARDS } from '../src/game/economy/economyConfig'
import { initialEconomyState } from '../src/game/economy/economyState'
import { transact } from '../src/game/economy/economyTransactions'
import { newResprayOperationId } from '../src/game/economy/garageResprayService'
import { useMissionStore } from '../src/game/missions/missionState'
import { CHECKPOINTS } from '../src/game/missions/checkpointRoute'
import { VEHICLES } from '../src/game/vehicles/vehicleConfig'
import { paintPreset,VEHICLE_PAINTS,playerPaintSlots } from '../src/game/vehicles/vehiclePaint'
import { useGarageStore } from '../src/game/garage/garageState'
import { isConfirmedParked } from '../src/game/garage/parkingDetector'
import { getVehicleRuntime,useVehicleStore } from '../src/game/vehicles/vehicleState'
import { useCharacterStore } from '../src/game/state/characterStore'
import { useDialogueStore } from '../src/game/interactions/dialogueState'
import { NPCS } from '../src/game/npcs/npcConfig'
await RAPIER.init()
let groups=0
const test=(name:string,run:()=>void)=>{run();groups++;console.log(`PASS  ${name}`)}
const first=()=>{
 const store=useMissionStore.getState()
 assert.ok(store.transition({kind:'accept',missionId:'first-contact',npcId:'maya',session:1}))
 assert.ok(store.transition({kind:'acknowledge',missionId:'first-contact',objectiveId:'meet-marcus',npcId:'marcus',session:2}))
 assert.ok(store.transition({kind:'acknowledge',missionId:'first-contact',objectiveId:'return-to-maya',npcId:'maya',session:3}))
}
const both=()=>{
 first();const store=useMissionStore.getState();assert.ok(store.transition({kind:'accept',missionId:'motor-row-shakedown',npcId:'marcus',session:4}))
 for(const g of CHECKPOINTS){const p={vehicleId:'street-coupe' as const,...g.spawn,y:g.spawn.y+.5,vx:g.direction.x*6,vz:g.direction.z*6,yaw:Math.atan2(-g.direction.x,-g.direction.z),up:1,revision:0};assert.ok(store.transition({kind:'checkpoint',missionId:'motor-row-shakedown',objectiveId:g.id,dt:1/60,previous:{...p,x:p.x-g.direction.x*.05,z:p.z-g.direction.z*.05},current:{...p,x:p.x+g.direction.x*.05,z:p.z+g.direction.z*.05}}))}
 assert.ok(store.transition({kind:'acknowledge',missionId:'motor-row-shakedown',objectiveId:'report-to-marcus',npcId:'marcus',session:5}))
}
test('new session starts with integer zero SC, empty ledger, factory paints and exactly two rewards',()=>{
 const e=initialEconomyState();assert.equal(e.balance,0);assert.equal(e.sequence,0);assert.deepEqual(e.transactions,[]);assert.ok(Object.values(e.paints).every(p=>p==='factory'))
 assert.deepEqual(Object.keys(MISSION_REWARDS),['first-contact','motor-row-shakedown']);assert.equal(MISSION_REWARDS['first-contact'].amount,150);assert.equal(MISSION_REWARDS['motor-row-shakedown'].amount,300);assert.equal(STREET_CASH.resprayPrice,125)
})
test('completion and reward publish atomically; acceptance, wrong NPC and partial objectives never earn',()=>{
 const f=economyFixture(),seen:number[]=[]
 const unsub=useMissionStore.subscribe(s=>{if(s.progress.status==='COMPLETED'){assert.equal(s.economy.balance,150);seen.push(s.economy.balance)}})
 const store=useMissionStore.getState();assert.ok(!store.transition({kind:'acknowledge',missionId:'first-contact',objectiveId:'return-to-maya',npcId:'maya',session:1}));assert.equal(store.economy.balance,0)
 first();assert.deepEqual(seen,[150]);unsub();const e=useMissionStore.getState().economy
 assert.equal(e.balance,150);assert.equal(e.transactions.length,1);assert.equal(e.transactions[0].id,'mission:first-contact');assert.equal(e.transactions[0].type,'EARN');f.free()
})
test('Shakedown earns only after final report; two completed missions produce 450 SC once',()=>{
 const f=economyFixture();both();const e=useMissionStore.getState().economy
 assert.equal(e.balance,450);assert.deepEqual(e.transactions.map(t=>t.amount),[150,300]);assert.deepEqual(e.transactions.map(t=>t.balanceAfter),[150,450]);assert.deepEqual(e.transactions.map(t=>t.sequence),[1,2])
 for(let j=0;j<10;j++)assert.ok(!useMissionStore.getState().transition({kind:'acknowledge',missionId:'motor-row-shakedown',objectiveId:'report-to-marcus',npcId:'marcus',session:6+j}))
 assert.equal(useMissionStore.getState().economy,e);useGarageStore.getState().show();useGarageStore.getState().close();assert.equal(useMissionStore.getState().economy,e);f.free()
})
test('central integer ledger rejects negative, fractional, nonfinite, overflow, duplicates and insufficient debits without mutation',()=>{
 const e=initialEconomyState(),command={id:'mission:first-contact',type:'EARN' as const,amount:150,reason:'First Contact Complete',missionId:'first-contact' as const}
 for(const amount of[-1,0,1.2,NaN,Infinity,Number.MAX_SAFE_INTEGER+1]){assert.ok(!transact(e,{...command,amount}).ok);assert.equal(e.balance,0);assert.equal(e.transactions.length,0)}
 const accepted=transact(e,command);assert.ok(accepted.ok);assert.ok(!transact(accepted.economy,command).ok)
 assert.ok(!transact({...e,balance:Number.MAX_SAFE_INTEGER},command).ok)
 assert.ok(!transact(e,{id:'respray:1',type:'SPEND',vehicleId:'street-coupe',paintId:'ember',amount:125,reason:'Body respray'}).ok)
 assert.deepEqual(e,initialEconomyState())
})
test('three original factory paints and two distinct additional presets per model',()=>{
 for(const d of VEHICLES){const p=VEHICLE_PAINTS[d.id];assert.equal(p.length,3);assert.equal(new Set(p.map(p=>p.id)).size,3);assert.equal(new Set(p.map(p=>p.color)).size,3)}
 assert.equal(paintPreset('street-coupe','factory')!.color,'#319ca7');assert.equal(paintPreset('city-sedan','factory')!.color,'#667da6');assert.equal(paintPreset('utility-pickup','factory')!.color,'#c88a3f')
})
for(const d of VEHICLES)test(`${d.id}: genuine Rapier parking permits atomic 125 SC debit and actual isolated material change`,()=>{
 const f=economyFixture();both();f.park(d);assert.ok(isConfirmedParked(d.id));assert.ok(useGarageStore.getState().open)
 const id=VEHICLES.indexOf(d),a=f.assets[id],otherColors=f.assets.map(a=>a.materials.body.color.getHexString()),glass=Array.from(a.geometries.glass.getAttribute('color').array),position={...f.entry(d.id).body.translation()},occupancy=useGarageStore.getState().occupancy,definitions=JSON.stringify(VEHICLES)
 const request={operationId:newResprayOperationId(),vehicleId:d.id,paintId:'ember'}
 const response=useMissionStore.getState().confirmRespray(request);assert.ok(response.ok)
 const e=useMissionStore.getState().economy;assert.equal(e.balance,325);assert.equal(e.transactions.length,3);assert.equal(e.transactions[2].type,'SPEND');assert.equal(e.transactions[2].amount,125);assert.equal(e.paints[d.id],'ember')
 assert.equal(a.materials.body.color.getHexString(),new Color(paintPreset(d.id,'ember')!.color).getHexString())
 assert.deepEqual(Array.from(a.geometries.glass.getAttribute('color').array),glass);assert.equal(JSON.stringify(VEHICLES),definitions);assert.deepEqual({...f.entry(d.id).body.translation()},position);assert.equal(useGarageStore.getState().occupancy,occupancy)
 for(let j=0;j<3;j++)if(j!==id)assert.equal(f.assets[j].materials.body.color.getHexString(),otherColors[j])
 assert.ok(!useMissionStore.getState().confirmRespray(request).ok);assert.equal(useMissionStore.getState().economy,e)
 assert.ok(!useMissionStore.getState().confirmRespray({...request,paintId:'violet'}).ok);assert.equal(useMissionStore.getState().economy,e)
 assert.ok(!useMissionStore.getState().confirmRespray({...request,operationId:newResprayOperationId()}).ok);assert.equal(useMissionStore.getState().economy,e)
 f.free();assert.equal(playerPaintSlots.size,0)
})
test('invalid vehicle/ambient/color, unparked, stale UI, driving, creator, dialogue and away-from-terminal reject unchanged',()=>{
 const f=economyFixture();both();const store=useMissionStore.getState(),e=store.economy,request={operationId:newResprayOperationId(),vehicleId:'street-coupe',paintId:'ember'}
 for(const change of[{vehicleId:'ambient-coupe'},{vehicleId:'missing'},{paintId:'missing'},{}]){assert.ok(!store.confirmRespray({...request,...change}).ok);assert.equal(useMissionStore.getState().economy,e)}
 useGarageStore.getState().publish({'motor-row-bay-1':'street-coupe'});assert.ok(!store.confirmRespray(request).ok)
 f.park(VEHICLES[0]);assert.ok(isConfirmedParked('street-coupe'))
 useVehicleStore.getState().setDriving(true);assert.ok(!store.confirmRespray(request).ok);useVehicleStore.getState().setDriving(false)
 useCharacterStore.getState().openMenu();assert.ok(!store.confirmRespray(request).ok);useCharacterStore.getState().cancel()
 useDialogueStore.getState().open(NPCS[0]);assert.ok(!store.confirmRespray(request).ok);useDialogueStore.getState().close()
 f.player.setTranslation({x:0,y:1,z:0},true);assert.ok(!store.confirmRespray(request).ok);assert.equal(useMissionStore.getState().economy,e)
 f.free()
})
test('confirm rechecks actual movement and recovery before the next 10 Hz parking publication',()=>{
 const f=economyFixture();both();f.park(VEHICLES[0]);const e=useMissionStore.getState().economy,body=f.entry('street-coupe').body,p={...body.translation()},request={operationId:newResprayOperationId(),vehicleId:'street-coupe',paintId:'ember'}
 body.setTranslation({...p,x:p.x+8},true);assert.ok(!useMissionStore.getState().confirmRespray(request).ok);assert.equal(useMissionStore.getState().economy,e);body.setTranslation(p,true)
 body.setLinvel({x:2,y:0,z:0},true);assert.ok(!useMissionStore.getState().confirmRespray(request).ok);body.setLinvel({x:0,y:0,z:0},true)
 getVehicleRuntime('street-coupe').state.recoveryRevision++;assert.ok(!useMissionStore.getState().confirmRespray(request).ok);assert.equal(useMissionStore.getState().economy,e);f.free()
})
test('insufficient funds and cancelled/absent operations preserve both paint and ledger',()=>{
 const f=economyFixture();f.park(VEHICLES[0]);const before=useMissionStore.getState().economy,r=useMissionStore.getState().confirmRespray({operationId:newResprayOperationId(),vehicleId:'street-coupe',paintId:'ember'})
 assert.ok(!r.ok&&r.message.includes('Insufficient'));assert.equal(useMissionStore.getState().economy,before)
 both()
 for(const paintId of ['ember','violet','factory'])assert.ok(useMissionStore.getState().confirmRespray({operationId:newResprayOperationId(),vehicleId:'street-coupe',paintId}).ok)
 const after=useMissionStore.getState().economy;assert.equal(after.balance,75);assert.equal(after.transactions.length,5)
 assert.ok(!useMissionStore.getState().confirmRespray({operationId:newResprayOperationId(),vehicleId:'street-coupe',paintId:'ember'}).ok);assert.equal(useMissionStore.getState().economy,after);assert.equal(after.paints['street-coupe'],'factory');assert.equal(new Set(after.transactions.map(t=>t.id)).size,5)
 f.free()
})
console.log(`ALL PASS (${groups} economy groups)`)
