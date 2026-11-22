import assert from 'node:assert/strict'
import RAPIER from '@dimforge/rapier3d-compat'
import { economyFixture } from './economy-fixture'
import { PROGRESS_KEY,type GuestSave } from '../src/game/persistence/persistenceSchema'
import { validateGuestSave } from '../src/game/persistence/persistenceValidation'
import { createPersistenceCoordinator } from '../src/game/persistence/persistenceCoordinator'
import { defaultVehiclePoses } from '../src/game/persistence/persistenceHydration'
import { useProgressSaveStore } from '../src/game/persistence/persistenceRuntime'
import { useMissionStore,initialMissionProgress,reduceMission } from '../src/game/missions/missionState'
import { initialEconomyState } from '../src/game/economy/economyState'
import { rewardMissionCompletion } from '../src/game/economy/missionRewards'
import { useCharacterStore } from '../src/game/state/characterStore'
import { CHECKPOINTS } from '../src/game/missions/checkpointRoute'
import { newResprayOperationId } from '../src/game/economy/garageResprayService'
import { GARAGE } from '../src/game/garage/garageConfig'
import { useGarageStore } from '../src/game/garage/garageState'
import { VEHICLES } from '../src/game/vehicles/vehicleConfig'
import { vehicleRegistry } from '../src/game/vehicles/vehicleState'
import { FIXED_DT } from '../src/game/character/config'
await RAPIER.init()
let count=0
const test=(name:string,run:()=>void)=>{run();count++;console.log(`PASS  ${name}`)}
class MemoryStorage{
 data=new Map<string,string>();writes=0;removes:string[]=[];quota=false;unreadable=false
 getItem(key:string){if(this.unreadable)throw Error('Blocked');return this.data.get(key)??null}
 setItem(key:string,value:string){if(this.quota)throw Error('Quota');this.writes++;this.data.set(key,value)}
 removeItem(key:string){if(this.quota)throw Error('Blocked');this.removes.push(key);this.data.delete(key)}
}
function core(stage='done'):GuestSave{
 let p=initialMissionProgress(),e=initialEconomyState()
 const apply=(event:Parameters<typeof reduceMission>[1])=>{const next=reduceMission(p,event);e=rewardMissionCompletion(e,p,next);p=next}
 if(stage!=='initial')apply({kind:'accept',missionId:'first-contact',npcId:'maya',session:1})
 if(!['initial','marcus'].includes(stage))apply({kind:'acknowledge',missionId:'first-contact',objectiveId:'meet-marcus',npcId:'marcus',session:2})
 if(!['initial','marcus','maya'].includes(stage))apply({kind:'acknowledge',missionId:'first-contact',objectiveId:'return-to-maya',npcId:'maya',session:3})
 if(!['initial','marcus','maya','first-done'].includes(stage)){
  apply({kind:'accept',missionId:'motor-row-shakedown',npcId:'marcus',session:4})
  for(const [i,g] of CHECKPOINTS.entries()){
   if(stage===`gate-${i}`)break
   const s={vehicleId:'street-coupe' as const,...g.spawn,y:g.spawn.y+.5,vx:g.direction.x*6,vz:g.direction.z*6,yaw:Math.atan2(-g.direction.x,-g.direction.z),up:1,revision:0}
   apply({kind:'checkpoint',missionId:'motor-row-shakedown',objectiveId:g.id,previous:{...s,x:s.x-g.direction.x*.05,z:s.z-g.direction.z*.05},current:{...s,x:s.x+g.direction.x*.05,z:s.z+g.direction.z*.05},dt:FIXED_DT})
  }
  if(stage==='done')apply({kind:'acknowledge',missionId:'motor-row-shakedown',objectiveId:'report-to-marcus',npcId:'marcus',session:5})
 }
 return {version:1,savedAt:1000,mission:{missionId:p.missionId,status:p.status,objectiveId:p.objectiveId,completed:p.completed},economy:e,claimedRewardIds:e.transactions.filter(t=>t.type==='EARN').map(t=>t.id),processedOperationIds:e.transactions.map(t=>t.id),vehicles:defaultVehiclePoses(),parking:[]}
}
function scene(storage:MemoryStorage|null,host?:{window:EventTarget;document:EventTarget&{hidden?:boolean}}){
 useProgressSaveStore.setState({status:'idle',message:'',restoring:false,blocked:false,savedAt:null})
 const f=economyFixture(),coordinator=createPersistenceCoordinator(()=>storage,()=>2000),off=coordinator.connect(f.physics,host)
 const pump=(n:number)=>{for(let j=0;j<n;j++){f.step(1);coordinator.step(f.physics,FIXED_DT)}}
 const free=()=>{off();f.free();useProgressSaveStore.setState({status:'idle',message:'',restoring:false,blocked:false,savedAt:null})}
 return {...f,coordinator,pump,free}
}
test('empty storage initializes once, writes a bounded versioned snapshot after world validation only',()=>{
 const storage=new MemoryStorage(),s=scene(storage)
 assert.equal(storage.writes,0);assert.equal(useProgressSaveStore.getState().restoring,true)
 assert.ok(!useMissionStore.getState().transition({kind:'accept',missionId:'first-contact',npcId:'maya',session:1}))
 s.pump(110);assert.ok(s.coordinator.ready);assert.equal(useMissionStore.getState().economy.balance,0)
 const raw=storage.data.get(PROGRESS_KEY)!;assert.ok(raw.length<65536);assert.ok(validateGuestSave(raw).ok);assert.equal((JSON.parse(raw) as GuestSave).version,1)
 const writes=storage.writes;s.coordinator.initialize();s.pump(180);assert.equal(storage.writes,writes)
 assert.ok(!/rawSet|material|camera|callback/.test(raw));s.free()
})
for(const stage of ['marcus','maya','first-done','gate-0','gate-1','gate-2','report','done'])test(`${stage}: mission/objective/reward history hydrates coherently without replaying rewards`,()=>{
 const storage=new MemoryStorage(),save=core(stage);storage.data.set(PROGRESS_KEY,JSON.stringify(save))
 const s=scene(storage);s.pump(110)
 assert.equal(useMissionStore.getState().progress.objectiveId,save.mission.objectiveId);assert.equal(useMissionStore.getState().progress.status,save.mission.status)
 assert.deepEqual(useMissionStore.getState().progress.completed,save.mission.completed);assert.equal(useMissionStore.getState().progress.lastDialogueSession,-1)
 assert.equal(useMissionStore.getState().economy.balance,save.economy.balance);assert.deepEqual(useMissionStore.getState().economy.transactions,save.economy.transactions)
 assert.equal(useMissionStore.getState().completionNotice,false);s.free()
})
test('both completed missions cannot restart or mint SC after reload; saved operation IDs remain consumed',()=>{
 const storage=new MemoryStorage(),save=core();storage.data.set(PROGRESS_KEY,JSON.stringify(save));const s=scene(storage);s.pump(110)
 const e=useMissionStore.getState().economy
 for(let j=1;j<4;j++)assert.ok(!useMissionStore.getState().transition({kind:'acknowledge',missionId:'motor-row-shakedown',objectiveId:'report-to-marcus',npcId:'marcus',session:j}))
 assert.ok(!useMissionStore.getState().transition({kind:'accept',missionId:'first-contact',npcId:'maya',session:4}));assert.equal(useMissionStore.getState().economy,e);assert.equal(e.balance,450);s.free()
})
test('actual Rapier drive-in + paid respray restore pose, legitimate occupancy, balance and actual paint with no charge',()=>{
 const storage=new MemoryStorage();storage.data.set(PROGRESS_KEY,JSON.stringify(core()))
 let s=scene(storage);s.pump(110);s.park(VEHICLES[0]);assert.ok(useGarageStore.getState().occupancy[GARAGE.bays[0].id])
 const operationId=newResprayOperationId();assert.ok(useMissionStore.getState().confirmRespray({operationId,vehicleId:'street-coupe',paintId:'ember'}).ok)
 assert.ok(s.coordinator.flush());const saved=JSON.parse(storage.data.get(PROGRESS_KEY)!) as GuestSave
 assert.equal(saved.economy.balance,325);assert.equal(saved.parking.length,1);const countBefore=s.world.bodies.len();s.free()
 s=scene(storage);s.pump(140)
 assert.equal(s.world.bodies.len(),countBefore);assert.equal(useMissionStore.getState().economy.balance,325);assert.equal(useMissionStore.getState().economy.transactions.length,3)
 assert.equal(s.assets[0].materials.body.color.getHexString(),'e45d43');assert.equal(s.assets[1].materials.body.color.getHexString(),'667da6');assert.equal(s.assets[2].materials.body.color.getHexString(),'c88a3f')
 assert.equal(useGarageStore.getState().occupancy[GARAGE.bays[0].id],'street-coupe')
 const position=s.entry('street-coupe').body.translation(),wanted=saved.vehicles.find(v=>v.vehicleId==='street-coupe')!
 assert.ok(Math.hypot(position.x-wanted.x,position.z-wanted.z)<.03);const velocity=s.entry('street-coupe').body.linvel();assert.ok(Math.hypot(velocity.x,velocity.y,velocity.z)<.01)
 s.atTerminal();const e=useMissionStore.getState().economy
 assert.ok(!useMissionStore.getState().confirmRespray({operationId,vehicleId:'street-coupe',paintId:'violet'}).ok);assert.equal(useMissionStore.getState().economy,e)
 const next=newResprayOperationId();assert.notEqual(next,operationId);assert.ok(useMissionStore.getState().confirmRespray({operationId:next,vehicleId:'street-coupe',paintId:'violet'}).ok);assert.equal(useMissionStore.getState().economy.balance,200)
 vehicleRegistry.get('street-coupe')!.state.recoveryRevision++;s.pump(10);assert.deepEqual(useGarageStore.getState().occupancy,{});void s.coordinator.flush();assert.equal((JSON.parse(storage.data.get(PROGRESS_KEY)!) as GuestSave).parking.length,0);const character=useCharacterStore.getState().settings;assert.ok(s.coordinator.reset());s.pump(120);assert.equal(useMissionStore.getState().economy.balance,0);assert.equal(s.assets[0].materials.body.color.getHexString(),'319ca7');assert.equal(useCharacterStore.getState().settings,character);for(const d of VEHICLES){const p=s.entry(d.id).body.translation();assert.ok(Math.hypot(p.x-d.spawn.x,p.z-d.spawn.z)<.1)};s.free()
})
test('building/airborne/out-of-bounds positions fall back independently without discarding economy',()=>{
 const save=core();save.vehicles[0]={vehicleId:'street-coupe',x:101,y:.53,z:-103,yaw:0,layoutVersion:1};save.vehicles[1].y=30;save.vehicles[2].x=999
 const storage=new MemoryStorage();storage.data.set(PROGRESS_KEY,JSON.stringify(save));const s=scene(storage);s.pump(130)
 for(const d of VEHICLES){const p=s.entry(d.id).body.translation();assert.ok(Math.hypot(p.x-d.spawn.x,p.z-d.spawn.z)<.1);assert.equal(s.entry(d.id).body.angvel().y,0)}
 assert.equal(useMissionStore.getState().economy.balance,450);s.free()
})
test('overlapping saved playable vehicles resolve to separate safe existing spawns',()=>{
 const save=core(),a=save.vehicles[0];save.vehicles[1]={...a,vehicleId:'city-sedan',y:.58}
 const storage=new MemoryStorage();storage.data.set(PROGRESS_KEY,JSON.stringify(save));const s=scene(storage);s.pump(130)
 const p=s.entry('street-coupe').body.translation(),q=s.entry('city-sedan').body.translation();assert.ok(Math.hypot(p.x-q.x,p.z-q.z)>10);assert.equal(useMissionStore.getState().economy.balance,450);s.free()
})
test('invalid or conflicting garage claims are discarded, never treated as a new drive-in',()=>{
 const save=core(),b=GARAGE.bays[0]
 save.vehicles[0]={vehicleId:'street-coupe',x:b.x,y:b.y+.5,z:b.z,yaw:0,layoutVersion:1}
 const claim={vehicleId:'street-coupe' as const,bayId:b.id,source:'drive-in' as const,pose:{x:b.x,y:b.y+.5,z:b.z,yaw:0}}
 save.parking=[claim,{...claim}]
 const parsed=validateGuestSave(JSON.stringify(save));assert.ok(parsed.ok);assert.equal(parsed.save.parking.length,0)
 const storage=new MemoryStorage();storage.data.set(PROGRESS_KEY,JSON.stringify(save));const s=scene(storage);s.pump(140);assert.deepEqual(useGarageStore.getState().occupancy,{});s.free()
})
test('malformed/future/inconsistent core saves are preserved, blocked from rewards/spending and require explicit reset',()=>{
 const variants=['{broken',JSON.stringify({...core(),version:2}),JSON.stringify({...core(),economy:{...core().economy,balance:999}})]
 for(const raw of variants){const storage=new MemoryStorage();storage.data.set(PROGRESS_KEY,raw);storage.data.set('vextride:guest:character','character-must-stay');const s=scene(storage);s.pump(120)
  assert.ok(useProgressSaveStore.getState().blocked);assert.equal(storage.data.get(PROGRESS_KEY),raw);assert.equal(storage.writes,0)
  assert.ok(!useMissionStore.getState().transition({kind:'accept',missionId:'first-contact',npcId:'maya',session:1}));assert.ok(!useMissionStore.getState().confirmRespray({operationId:'respray:1',vehicleId:'street-coupe',paintId:'ember'}).ok)
  assert.ok(s.coordinator.reset());s.pump(120);assert.equal(useMissionStore.getState().progress.status,'NOT_STARTED');assert.equal(useMissionStore.getState().economy.balance,0);assert.equal(storage.data.get('vextride:guest:character'),'character-must-stay');assert.deepEqual(storage.removes,[PROGRESS_KEY]);assert.ok(validateGuestSave(storage.data.get(PROGRESS_KEY)!).ok);s.free()
 }
})
test('invalid IDs, amounts, duplicate entries, unlock dependencies and paint/claimed history inconsistencies reject',()=>{
 for(const mutate of[(s:GuestSave)=>{s.economy={...s.economy,balance:-1}},(s:GuestSave)=>{s.economy={...s.economy,transactions:[...s.economy.transactions,s.economy.transactions[0]]}},(s:GuestSave)=>{s.mission={...s.mission,objectiveId:'checkpoint-a'}},(s:GuestSave)=>{s.claimedRewardIds=[]},(s:GuestSave)=>{s.processedOperationIds=[]},(s:GuestSave)=>{s.economy={...s.economy,paints:{...s.economy.paints,'street-coupe':'ember'}}}]){const save=core();mutate(save);assert.ok(!validateGuestSave(JSON.stringify(save)).ok)}
 const raw=JSON.parse(JSON.stringify(core())) as {economy:{transactions:Array<{amount:number;missionId:string}>}}
 raw.economy.transactions[0].amount=150.5;assert.ok(!validateGuestSave(JSON.stringify(raw)).ok)
 raw.economy.transactions[0].amount=150;raw.economy.transactions[0].missionId='unknown';assert.ok(!validateGuestSave(JSON.stringify(raw)).ok)
})
test('unreadable/quota-limited storage cannot falsely report a durable save or partially reset progress',()=>{
 const storage=new MemoryStorage();storage.data.set(PROGRESS_KEY,JSON.stringify(core('initial')));const s=scene(storage);s.pump(110)
 const old=storage.data.get(PROGRESS_KEY);storage.quota=true
 useMissionStore.getState().transition({kind:'accept',missionId:'first-contact',npcId:'maya',session:1});assert.equal(useProgressSaveStore.getState().status,'pending');assert.ok(!s.coordinator.flush());assert.equal(useProgressSaveStore.getState().status,'error');assert.equal(storage.data.get(PROGRESS_KEY),old)
 assert.ok(!s.coordinator.reset());assert.equal(useMissionStore.getState().progress.status,'ACTIVE');s.free()
 const unreadable=new MemoryStorage();unreadable.unreadable=true;const u=scene(unreadable);u.pump(110);assert.equal(unreadable.writes,0);assert.ok(!useProgressSaveStore.getState().blocked);assert.notEqual(useProgressSaveStore.getState().status,'saved');u.free()
})
test('StrictMode-like reconnect is idempotent, subscriptions/listeners release and lifecycle flush is throttled',()=>{
 const storage=new MemoryStorage(),w=new EventTarget(),d=Object.assign(new EventTarget(),{hidden:false}),s=scene(storage,{window:w,document:d});s.pump(120);const before=storage.writes
 const off=s.coordinator.connect(s.physics,{window:w,document:d})
 assert.equal(s.coordinator.connections,2);off();assert.equal(s.coordinator.connections,1)
 for(let i=0;i<3;i++){const release=s.coordinator.connect(s.physics);release()}
 s.pump(180);assert.equal(storage.writes,before)
 const position=s.entry('street-coupe').body.translation();s.entry('street-coupe').body.setTranslation({...position,x:position.x+1},true);s.pump(1)
 const flushOff=s.coordinator.connect(s.physics,{window:w,document:d});w.dispatchEvent(new Event('pagehide'));assert.ok(storage.writes>before);flushOff();s.free();assert.equal(s.coordinator.connections,0)
})
test('restored active objective accepts fresh dialogue sessions and still rejects wrong NPC and duplicate acknowledgement',()=>{
 const storage=new MemoryStorage();storage.data.set(PROGRESS_KEY,JSON.stringify(core('marcus')));const s=scene(storage);s.pump(110)
 const transition=useMissionStore.getState().transition
 assert.ok(!transition({kind:'acknowledge',missionId:'first-contact',objectiveId:'meet-marcus',npcId:'maya',session:1}))
 assert.ok(transition({kind:'acknowledge',missionId:'first-contact',objectiveId:'meet-marcus',npcId:'marcus',session:1}))
 assert.ok(!transition({kind:'acknowledge',missionId:'first-contact',objectiveId:'return-to-maya',npcId:'maya',session:1}))
 assert.ok(transition({kind:'acknowledge',missionId:'first-contact',objectiveId:'return-to-maya',npcId:'maya',session:2}))
 assert.equal(useMissionStore.getState().economy.balance,150);assert.equal(useMissionStore.getState().economy.transactions.length,1);s.free()
})
test('external-tab save changes pause writes and rewards without clobbering the new stored record',()=>{
 const storage=new MemoryStorage(),w=new EventTarget(),d=Object.assign(new EventTarget(),{hidden:false}),s=scene(storage,{window:w,document:d});s.pump(110)
 const external=JSON.stringify(core('first-done'));storage.data.set(PROGRESS_KEY,external)
 const event=new Event('storage');Object.defineProperties(event,{key:{value:PROGRESS_KEY},newValue:{value:external}});w.dispatchEvent(event)
 assert.ok(useProgressSaveStore.getState().blocked);assert.ok(!s.coordinator.flush());assert.equal(storage.data.get(PROGRESS_KEY),external)
 assert.ok(!useMissionStore.getState().transition({kind:'accept',missionId:'first-contact',npcId:'maya',session:1}));s.free()
})
test('flush and reset recheck storage when a newer tab revision has not been delivered as an event',()=>{
 const storage=new MemoryStorage(),s=scene(storage);s.pump(110)
 const external=JSON.stringify(core('first-done'))
 storage.data.set(PROGRESS_KEY,external)
 assert.ok(useMissionStore.getState().transition({kind:'accept',missionId:'first-contact',npcId:'maya',session:1}))
 assert.equal(s.coordinator.flush(),false)
 assert.equal(s.coordinator.reset(),false)
 assert.equal(useProgressSaveStore.getState().status,'conflict')
 assert.equal(storage.data.get(PROGRESS_KEY),external);s.free()
})
test('a cross-tab storage clear blocks recreation of the old guest save',()=>{
 const storage=new MemoryStorage(),w=new EventTarget(),d=new EventTarget(),s=scene(storage,{window:w,document:d});s.pump(110)
 storage.data.clear()
 const event=new Event('storage');Object.defineProperty(event,'key',{value:null});w.dispatchEvent(event)
 assert.equal(useProgressSaveStore.getState().status,'conflict')
 assert.equal(s.coordinator.reset(),false)
 s.free();assert.equal(storage.data.has(PROGRESS_KEY),false)
})
console.log(`ALL PASS (${count} persistence groups)`)
