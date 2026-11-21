import { canMutateGuestProgress } from '../persistence/persistenceRuntime'
import { initialEconomyState,type EconomySnapshot } from '../economy/economyState'
import { rewardMissionCompletion } from '../economy/missionRewards'
import { respray,type ResprayRequest } from '../economy/garageResprayService'
import { create } from 'zustand'
import { FIRST_CONTACT,MISSIONS,missionDefinition,type MissionId,type ObjectiveId } from './missionDefinitions'
import { crossesCheckpoint,type VehicleSample } from './checkpointCrossing'
import type { NPCId } from '../npcs/npcConfig'
export type MissionStatus='NOT_STARTED'|'ACTIVE'|'COMPLETED'
export interface MissionProgress {missionId:MissionId;status:MissionStatus;objectiveId:ObjectiveId|null;lastDialogueSession:number;completed?:readonly MissionId[]}
export type MissionEvent={kind:'accept';missionId:MissionId;npcId:NPCId;session:number}|{kind:'acknowledge';missionId:MissionId;objectiveId:ObjectiveId;npcId:NPCId;session:number}|{kind:'checkpoint';missionId:MissionId;objectiveId:ObjectiveId;previous:VehicleSample;current:VehicleSample;dt:number}
export const initialMissionProgress=():MissionProgress=>({missionId:FIRST_CONTACT.id,status:'NOT_STARTED',objectiveId:null,lastDialogueSession:-1,completed:[]})
export function currentObjective(progress:MissionProgress){return progress.status==='ACTIVE'?missionDefinition(progress.missionId).objectives.find(o=>o.id===progress.objectiveId):undefined}
export function missionStatus(progress:MissionProgress,id:MissionId):'LOCKED'|'AVAILABLE'|'ACTIVE'|'COMPLETED'{
 if(progress.completed?.includes(id)||(progress.missionId===id&&progress.status==='COMPLETED'))return 'COMPLETED'
 if(progress.missionId===id&&progress.status==='ACTIVE')return 'ACTIVE'
 const requires=missionDefinition(id).requires
 return requires&&missionStatus(progress,requires)!=='COMPLETED'?'LOCKED':'AVAILABLE'
}
export function availableMission(progress:MissionProgress,npcId:NPCId){return progress.status==='ACTIVE'?undefined:MISSIONS.find(m=>m.giver===npcId&&missionStatus(progress,m.id)==='AVAILABLE')}
function advance(progress:MissionProgress):MissionProgress{
 const definition=missionDefinition(progress.missionId),objective=currentObjective(progress)!,next=definition.objectives[definition.objectives.indexOf(objective)+1]
 return {...progress,status:next?'ACTIVE':'COMPLETED',objectiveId:next?.id??null,completed:next?progress.completed:[...new Set([...(progress.completed??[]),progress.missionId])]}
}
/** Invalid, stale, duplicate and out-of-order events preserve the same state object. */
export function reduceMission(progress:MissionProgress,event:MissionEvent):MissionProgress {
 if(event.kind==='checkpoint'){
  const objective=currentObjective(progress)
  return event.missionId===progress.missionId&&event.objectiveId===objective?.id&&objective.checkpointId&&crossesCheckpoint(objective.checkpointId,event.previous,event.current,event.dt)?advance(progress):progress
 }
 if(!Number.isSafeInteger(event.session)||event.session<=0||event.session<=progress.lastDialogueSession)return progress
 if(event.kind==='accept'){
  const definition=missionDefinition(event.missionId)
  return progress.status!=='ACTIVE'&&missionStatus(progress,event.missionId)==='AVAILABLE'&&event.npcId===definition.giver?
   {...progress,missionId:event.missionId,status:'ACTIVE',objectiveId:definition.objectives[0].id,lastDialogueSession:event.session}:progress
 }
 const objective=currentObjective(progress)
 if(event.missionId!==progress.missionId||!objective?.npcId||event.objectiveId!==objective.id||event.npcId!==objective.npcId)return progress
 return advance({...progress,lastDialogueSession:event.session})
}
/** One coherent guest-progress atom. Hydration restores this snapshot without invoking reward actions. */
export const useMissionStore=create<{
 progress:MissionProgress;completionNotice:boolean;economy:EconomySnapshot
 confirmRespray:(request:ResprayRequest)=>{ok:boolean;message:string}
 transition:(event:MissionEvent)=>boolean;dismissCompletion:()=>void
}>((set,get)=>({
 progress:initialMissionProgress(),completionNotice:false,economy:initialEconomyState(),
 confirmRespray:request=>{if(!canMutateGuestProgress())return {ok:false,message:'Guest progress is not ready. Check local save settings.'};const result=respray(get().economy,request);if(!result.ok)return result;set({economy:result.economy});return {ok:true,message:"Respray complete — 125 SC spent."}},
 transition:(event)=>{if(!canMutateGuestProgress())return false;const previous=get().progress,next=reduceMission(previous,event);if(next===previous)return false;set({progress:next,completionNotice:next.status==='COMPLETED',economy:rewardMissionCompletion(get().economy,previous,next)});return true},
 dismissCompletion:()=>set(s=>s.completionNotice?{completionNotice:false}:s),
}))
