import { NPCS,type NPCId } from '../npcs/npcConfig'
export type MissionId='first-contact'
export type ObjectiveId='meet-marcus'|'return-to-maya'
export interface MissionObjective {id:ObjectiveId;npcId:NPCId;text:string;acknowledgement:string;action:string}
export interface MissionDefinition {id:MissionId;title:string;giver:NPCId;introduction:string;objectives:readonly MissionObjective[]}
export const MISSIONS:readonly MissionDefinition[]=[{
 id:'first-contact',title:'First Contact',giver:'maya',
 introduction:"Go introduce yourself to Marcus at the Motor Row garage. Once you've talked, come back and let me know.",
 objectives:[
  {id:'meet-marcus',npcId:'marcus',text:'Talk to Marcus at Motor Row.',acknowledgement:"Maya sent you? Good to meet you. I'm Marcus. You've found the garage—head back and tell her we talked.",action:"I'll let Maya know"},
  {id:'return-to-maya',npcId:'maya',text:'Return to Maya at Central Plaza.',acknowledgement:"You met Marcus? Good. Now you know where to find us both. Thanks for stopping back.",action:'Finish First Contact'},
 ],
}]
export const FIRST_CONTACT=MISSIONS[0]
export const missionDefinition=(id:MissionId)=>MISSIONS.find(m=>m.id===id)!
export const objectiveNPC=(objective:MissionObjective)=>NPCS.find(n=>n.id===objective.npcId)!
