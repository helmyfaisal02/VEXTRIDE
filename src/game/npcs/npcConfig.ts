import { BUILDINGS } from '../environment/buildingPlacements'
import { CITY_SPAWN } from '../city/cityConfig'
import { surfaceHeightAt } from '../city/citySurface'
export type NPCId='marcus'|'maya'
export interface NPCDefinition {
 id:NPCId;name:string;role:string;appearance:'mechanic'|'dispatcher'
 spawn:{x:number;y:number;z:number};yaw:number;scale:number;radius:number;range:number
 lines:readonly string[]
}
const garage=BUILDINGS.find(b=>b.type==='garage')!
const spawn=(x:number,z:number)=>({x,y:surfaceHeightAt(x,z),z})
export const NPCS:readonly NPCDefinition[]=[
 {id:'marcus',name:'Marcus',role:'Mechanic',appearance:'mechanic',spawn:spawn(garage.x-garage.width/2+2,garage.z+garage.depth/2+3),yaw:0,scale:1,radius:.27,range:2.8,
 lines:["I'm Marcus. You'll usually find me here by the garage.","The coupe is quick, the sedan is steady, and the pickup takes a little more room to turn.","Take them for a spin. Leave the driveway clear when you park."]},
 {id:'maya',name:'Maya',role:'Dispatcher',appearance:'dispatcher',spawn:spawn(CITY_SPAWN.x-8,CITY_SPAWN.z),yaw:Math.PI/2,scale:.95,radius:.26,range:2.8,
 lines:["Hey, I'm Maya, the dispatcher. Welcome to Central Plaza.","This is a good place to get your bearings. Motor Row is northeast of here.","If you're looking for a drive, there are three parked vehicles around the city. Take your time exploring."]},
]
export const npcHeight=(d:NPCDefinition)=>1.9*d.scale
