import { useDialogueStore } from '../interactions/dialogueState'
import { useCharacterStore } from '../state/characterStore'
import { useVehicleStore,vehicleRuntime } from '../vehicles/vehicleState'
import { npcRegistry } from '../npcs/npcState'
import { FIRST_CONTACT,missionDefinition,type MissionId,type ObjectiveId } from './missionDefinitions'
import { missionStatus,useMissionStore } from './missionState'
/** Actions must belong to the currently open, on-foot, in-range NPC conversation. */
function dialogueContext(session:number){
 const dialogue=useDialogueStore.getState(),player=vehicleRuntime.pedestrian
 if(!dialogue.active||dialogue.session!==session||useCharacterStore.getState().menuOpen||useVehicleStore.getState().driving||!player?.isValid()||!player.isEnabled())return null
 const npc=npcRegistry.get(dialogue.active.id)
 if(!npc?.body.isValid())return null
 const p=player.translation(),n=npc.body.translation()
 if(Math.hypot(p.x-n.x,p.z-n.z)>npc.definition.range+.001||Math.abs(p.y-(npc.definition.spawn.y+.9))>1.4)return null
 return npc.definition
}
export function acceptMission(session:number,missionId:MissionId=FIRST_CONTACT.id){
 const npc=dialogueContext(session)
 if(!npc)return false
 const accepted=useMissionStore.getState().transition({kind:'accept',missionId,npcId:npc.id,session})
 if(accepted)useDialogueStore.getState().close()
 return accepted
}
export function declineMission(session:number,missionId:MissionId=FIRST_CONTACT.id){
 const npc=dialogueContext(session)
 if(npc?.id!==missionDefinition(missionId).giver||missionStatus(useMissionStore.getState().progress,missionId)!=='AVAILABLE')return false
 useDialogueStore.getState().close()
 return true
}
export function acknowledgeObjective(objectiveId:ObjectiveId,session:number){
 const npc=dialogueContext(session)
 if(!npc)return false
 const changed=useMissionStore.getState().transition({kind:'acknowledge',missionId:useMissionStore.getState().progress.missionId,objectiveId,npcId:npc.id,session})
 if(changed)useDialogueStore.getState().close()
 return changed
}
