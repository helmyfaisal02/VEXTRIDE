import { missionDefinition,objectiveNPC } from './missionDefinitions'
import { currentObjective,type MissionProgress } from './missionState'
export function missionTarget(progress:MissionProgress){const objective=currentObjective(progress);return objective?objectiveNPC(objective):null}
export function missionHUD(progress:MissionProgress){const objective=currentObjective(progress),target=missionTarget(progress);return objective&&target?{title:missionDefinition(progress.missionId).title,objective:objective.text,target}:null}
export function targetReadout(player:{x:number;z:number},target:{x:number;z:number}){
 const dx=target.x-player.x,dz=target.z-player.z,distance=Math.hypot(dx,dz)
 const bearing=(Math.atan2(dx,-dz)+Math.PI*2)%(Math.PI*2)
 const compass=['N','NE','E','SE','S','SW','W','NW'][Math.round(bearing/(Math.PI/4))%8]
 return `${compass} · ${Math.round(distance)} m straight-line`
}
