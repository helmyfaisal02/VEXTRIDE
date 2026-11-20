import { create } from 'zustand'
import { FIRST_CONTACT,missionDefinition,type MissionId,type ObjectiveId } from './missionDefinitions'
import type { NPCId } from '../npcs/npcConfig'
export type MissionStatus='NOT_STARTED'|'ACTIVE'|'COMPLETED'
export interface MissionProgress {missionId:MissionId;status:MissionStatus;objectiveId:ObjectiveId|null;lastDialogueSession:number}
export type MissionEvent={kind:'accept';missionId:MissionId;npcId:NPCId;session:number}|{kind:'acknowledge';missionId:MissionId;objectiveId:ObjectiveId;npcId:NPCId;session:number}
export const initialMissionProgress=():MissionProgress=>({missionId:FIRST_CONTACT.id,status:'NOT_STARTED',objectiveId:null,lastDialogueSession:-1})
export function currentObjective(progress:MissionProgress){return progress.status==='ACTIVE'?missionDefinition(progress.missionId).objectives.find(o=>o.id===progress.objectiveId):undefined}
/** Invalid, stale, duplicate and out-of-order events preserve the same state object. */
export function reduceMission(progress:MissionProgress,event:MissionEvent):MissionProgress {
 const definition=missionDefinition(progress.missionId)
 if(event.missionId!==progress.missionId||!Number.isSafeInteger(event.session)||event.session<=0||event.session<=progress.lastDialogueSession)return progress
 if(event.kind==='accept')return progress.status==='NOT_STARTED'&&event.npcId===definition.giver?{...progress,status:'ACTIVE',objectiveId:definition.objectives[0].id,lastDialogueSession:event.session}:progress
 const objective=currentObjective(progress)
 if(!objective||event.objectiveId!==objective.id||event.npcId!==objective.npcId)return progress
 const next=definition.objectives[definition.objectives.indexOf(objective)+1]
 return {...progress,status:next?'ACTIVE':'COMPLETED',objectiveId:next?.id??null,lastDialogueSession:event.session}
}
/** Session-only: no persistence, restart action, rewards, timers or networking in the store. */
export const useMissionStore=create<{
 progress:MissionProgress;completionNotice:boolean
 transition:(event:MissionEvent)=>boolean;dismissCompletion:()=>void
}>((set,get)=>({
 progress:initialMissionProgress(),completionNotice:false,
 transition:(event)=>{const previous=get().progress,next=reduceMission(previous,event);if(next===previous)return false;set({progress:next,completionNotice:next.status==='COMPLETED'});return true},
 dismissCompletion:()=>set(s=>s.completionNotice?{completionNotice:false}:s),
}))
