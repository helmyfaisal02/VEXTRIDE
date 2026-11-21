import { CHECKPOINTS,type CheckpointId } from './checkpointRoute'
import { NPCS,type NPCId } from '../npcs/npcConfig'
export type MissionId='first-contact'|'motor-row-shakedown'
export type ObjectiveId='meet-marcus'|'return-to-maya'|CheckpointId|'report-to-marcus'
export interface MissionObjective {id:ObjectiveId;npcId?:NPCId;checkpointId?:CheckpointId;text:string;acknowledgement:string;action:string}
export interface MissionDefinition {id:MissionId;title:string;giver:NPCId;introduction:string;requires?:MissionId;objectives:readonly MissionObjective[]}
export const MISSIONS:readonly MissionDefinition[]=[{
 id:'first-contact',title:'First Contact',giver:'maya',
 introduction:"Go introduce yourself to Marcus at the Motor Row garage. Once you've talked, come back and let me know.",
 objectives:[
  {id:'meet-marcus',npcId:'marcus',text:'Talk to Marcus at Motor Row.',acknowledgement:"Maya sent you? Good to meet you. I'm Marcus. You've found the garage—head back and tell her we talked.",action:"I'll let Maya know"},
  {id:'return-to-maya',npcId:'maya',text:'Return to Maya at Central Plaza.',acknowledgement:"You met Marcus? Good. Now you know where to find us both. Thanks for stopping back.",action:'Finish First Contact'},
 ],
},{
 id:'motor-row-shakedown',title:'Motor Row Shakedown',giver:'marcus',requires:'first-contact',
 introduction:"I want to see how you handle these streets. Take any of the parked cars east along the north road, south at the corner, then west toward the garage. Follow the three markers, then come back.",
 objectives:[
  ...CHECKPOINTS.map(g=>({id:g.id,checkpointId:g.id,text:`Drive through ${g.name} (${g.order+1}/3).`,acknowledgement:'',action:''})),
  {id:'report-to-marcus',npcId:'marcus',text:'Return to Marcus at Motor Row.',acknowledgement:"That was the whole circuit. Nice work keeping it steady. You're getting to know these streets.",action:'Finish Motor Row Shakedown'},
 ],
}]
export const FIRST_CONTACT=MISSIONS[0]
export const MOTOR_ROW_SHAKEDOWN=MISSIONS[1]
export const missionDefinition=(id:MissionId)=>MISSIONS.find(m=>m.id===id)!
export const objectiveNPC=(objective:MissionObjective)=>NPCS.find(n=>n.id===objective.npcId)!
