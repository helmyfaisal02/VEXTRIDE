import type { useRapier } from '@react-three/rapier'
import { useMissionStore,initialMissionProgress } from '../missions/missionState'
import { initialEconomyState } from '../economy/economyState'
import { restoreRespraySequence } from '../economy/garageResprayService'
import { useGarageStore } from '../garage/garageState'
import { savedParkingRecords,queueRestoredParking } from '../garage/parkingDetector'
import { useVehicleStore,vehicleRuntime } from '../vehicles/vehicleState'
import { useDialogueStore } from '../interactions/dialogueState'
import { resetInput } from '../input/inputState'
import { useProgressSaveStore } from './persistenceRuntime'
import { validateGuestSave } from './persistenceValidation'
import { browserProgressStorage,readProgress,writeProgress,removeProgress,type ProgressStorage } from './persistenceStorage'
import { defaultVehiclePoses,captureSafeVehiclePoses,restoreVehiclePoses } from './persistenceHydration'
import { PROGRESS_KEY } from './persistenceSchema'
import type { GuestSave,SavedParking } from './persistenceSchema'
type Physics=Pick<ReturnType<typeof useRapier>,'world'|'rapier'>
type ProgressLock=(action:()=>boolean)=>boolean|Promise<boolean>
const round=(v:number)=>Math.round(v*1e5)/1e5
export function createPersistenceCoordinator(
 storageProvider:()=>ProgressStorage|null=browserProgressStorage,
 now=()=>Date.now(),
 withLock:ProgressLock=action=>action(),
){
 let initialized=false,storage:ProgressStorage|null=null,poses=defaultVehiclePoses(),parking:SavedParking[]=[],lastFingerprint='',lastStoredRaw:string|null=null,physics:Physics|null=null
 let releaseResources:(()=>void)|null=null
 let saving=false
 let stage:'waiting'|'settling'|'ready'='waiting',elapsed=0,settled=0,timer:ReturnType<typeof setTimeout>|null=null,connections=0,lastWorld:Physics['world']|null=null
 const setStatus=useProgressSaveStore.setState
 function initialize(){
  if(initialized)return
  initialized=true;setStatus({status:'loading',message:'Loading local guest progress.',restoring:true,blocked:false,savedAt:null})
  try{storage=storageProvider()}catch{storage=null}
  const read=readProgress(storage)
  if(!read.available){storage=null;setStatus({status:'memory',message:'Local storage is unavailable. Progress is only in this tab.'});return}
  lastStoredRaw=read.raw
  if(read.raw===null){setStatus({status:'loading',message:'Preparing local guest progress.'});return}
  const checked=validateGuestSave(read.raw)
  if(!checked.ok){setStatus({status:checked.unsupported?'unsupported':'invalid',message:`${checked.message} The original save is preserved. Reset guest progress to start fresh.`,blocked:true});return}
  const save=checked.save
  useMissionStore.setState({progress:{...save.mission,lastDialogueSession:-1},economy:save.economy,completionNotice:false})
  restoreRespraySequence(save.processedOperationIds);poses=save.vehicles;parking=save.parking
  setStatus({status:'saved',savedAt:save.savedAt,message:checked.warning||'Guest progress loaded locally.'})
 }
 function snapshot():GuestSave{
  const s=useMissionStore.getState(),vehicles=poses.map(p=>({...p,x:round(p.x),y:round(p.y),z:round(p.z),yaw:round(Math.atan2(Math.sin(p.yaw),Math.cos(p.yaw)))}))
  return {version:1,savedAt:now(),mission:{missionId:s.progress.missionId,status:s.progress.status,objectiveId:s.progress.objectiveId,completed:s.progress.completed??[]},economy:s.economy,claimedRewardIds:s.economy.transactions.filter(t=>t.type==='EARN').map(t=>t.id),processedOperationIds:s.economy.transactions.map(t=>t.id),vehicles,parking:parking.map(p=>({...p,pose:{x:round(p.pose.x),y:round(p.pose.y),z:round(p.pose.z),yaw:round(p.pose.yaw)}}))}
 }
 function runStorageAction(action:()=>boolean){
  const failed=()=>{
   if(!useProgressSaveStore.getState().blocked)setStatus({status:'error',message:'Local storage is unavailable. Guest progress was not written.'})
   return false
  }
  try{
   const result=withLock(action)
   return typeof result==='boolean'?result:result.catch(failed)
  }catch{return failed()}
 }
 function matchesStoredProgress(){
  const read=readProgress(storage)
  if(!read.available)return false
  if(read.raw===lastStoredRaw)return true
  setStatus({status:'conflict',blocked:true,message:'Guest save changed in another tab. Reload to load it; writes and reset are paused.'})
  return false
 }
 function flush(){
  if(stage!=='ready'||!physics||saving||useProgressSaveStore.getState().blocked)return false
  if(!storage)return false
  poses=captureSafeVehiclePoses(physics,poses);parking=savedParkingRecords()
  const save=snapshot(),fingerprint=JSON.stringify({...save,savedAt:0})
  saving=true
  const result=runStorageAction(()=>{
   if(stage!=='ready'||useProgressSaveStore.getState().blocked)return false
   if(!matchesStoredProgress()){
    if(!useProgressSaveStore.getState().blocked)setStatus({status:'error',message:'The current local save could not be read. Guest progress was not written.'})
    return false
   }
   if(fingerprint===lastFingerprint){if(['pending','error'].includes(useProgressSaveStore.getState().status))setStatus({status:'saved',message:'Guest progress saved locally.'});return true}
   // Validate the serialized snapshot before replacing the current save.
   const raw=JSON.stringify(save),valid=validateGuestSave(raw)
   if(!valid.ok){setStatus({status:'error',message:'Current progress could not be validated for saving. Previous local save is unchanged.'});return false}
   if(!writeProgress(storage,raw)){setStatus({status:'error',message:'Local save failed or storage is full. Progress is only in this tab; the previous save is unchanged.'});return false}
   lastFingerprint=fingerprint;lastStoredRaw=raw;setStatus({status:'saved',savedAt:save.savedAt,message:'Guest progress saved locally.'});return true
  })
  if(typeof result==='boolean'){saving=false;return result}
  return result.finally(()=>{saving=false})
 }
 function schedule(){if(stage!=='ready'||!storage||useProgressSaveStore.getState().blocked||timer)return;setStatus({status:'pending',message:'Saving guest progress locally…'});timer=setTimeout(()=>{timer=null;void flush()},250)}
 function step(ctx:Physics,dt:number){
  if(!initialized)return
  physics=ctx
  if(stage==='waiting'){
   const result=restoreVehiclePoses(ctx,poses,parking)
   if(!result)return
   poses=result.poses;stage='settling';settled=0;resetInput();return
  }
  if(stage==='settling'){
   resetInput();settled+=dt
   if(settled>=1.3){stage='ready';setStatus({restoring:false});elapsed=0;if(!useProgressSaveStore.getState().blocked)void flush()}
   return
  }
  elapsed+=dt;if(elapsed>=2){elapsed=0;void flush()}
 }
 function connect(ctx:Physics,host?:{window:EventTarget;document:EventTarget&{hidden?:boolean}}){
  initialize();physics=ctx
  if(lastWorld!==ctx.world){lastWorld=ctx.world;stage='waiting';setStatus({restoring:true});elapsed=0}
  if(connections===0){
   const unsub=useMissionStore.subscribe((s,p)=>{if(s.progress!==p.progress||s.economy!==p.economy)schedule()})
   const garage=useGarageStore.subscribe((s,p)=>{if(s.occupancy!==p.occupancy)schedule()})
   const hide=()=>{void flush()},visibility=()=>{if(host?.document.hidden)void flush()}
   const external=(event:Event)=>{
    const change=event as StorageEvent
    if((change.key===PROGRESS_KEY||change.key===null)&&(!change.storageArea||change.storageArea===storage))matchesStoredProgress()
   }
   host?.window.addEventListener('storage',external);host?.window.addEventListener('pagehide',hide);host?.document.addEventListener('visibilitychange',visibility)
   releaseResources=()=>{void flush();unsub();garage();host?.window.removeEventListener('storage',external);host?.window.removeEventListener('pagehide',hide);host?.document.removeEventListener('visibilitychange',visibility);if(timer){clearTimeout(timer);timer=null};physics=null}
  }
  connections++;let released=false
  return ()=>{if(released)return;released=true;connections--;if(connections===0){releaseResources?.();releaseResources=null}}
 }

 function reset(){
  if(useVehicleStore.getState().driving||stage!=='ready'||!physics)return false
  return runStorageAction(resetCurrentProgress)
 }
 function resetCurrentProgress(){
  if(useVehicleStore.getState().driving||stage!=='ready'||!physics||useProgressSaveStore.getState().status==='conflict')return false
  if(!matchesStoredProgress()||!removeProgress(storage)){
   if(useProgressSaveStore.getState().status!=='conflict')setStatus({status:'error',message:'The local save could not be cleared. No progress was reset.'})
   return false
  }
  stage='waiting';setStatus({status:'loading',message:'Resetting local guest progress.',restoring:true,blocked:false,savedAt:null})
  useGarageStore.getState().close();useDialogueStore.getState().close();useVehicleStore.getState().setDriving(false);vehicleRuntime.pedestrian?.setEnabled(true);resetInput()
  useMissionStore.setState({progress:initialMissionProgress(),economy:initialEconomyState(),completionNotice:false})
  poses=defaultVehiclePoses();parking=[];queueRestoredParking([]);useGarageStore.getState().publish({});lastFingerprint='';lastStoredRaw=null;return true
 }
 return {initialize,connect,step,flush,reset,snapshot,get connections(){return connections},get ready(){return stage==='ready'}}
}
export const guestPersistence=createPersistenceCoordinator(browserProgressStorage,Date.now,
 action=>typeof navigator!=='undefined'&&navigator.locks?navigator.locks.request(PROGRESS_KEY,action):action())
