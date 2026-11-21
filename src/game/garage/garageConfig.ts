import { BUILDINGS } from '../environment/buildingPlacements'
import { motorParking } from '../city/driveways'
import { surfaceHeightAt } from '../city/citySurface'
const garage=BUILDINGS.find(b=>b.id==='building-12')!,pad=motorParking().north
export interface GarageParkingBay {id:string;name:string;x:number;z:number;y:number;width:number;length:number;yaw:number}
const bay=(index:number,stall:number):GarageParkingBay=>{
 const x=pad.minX+1+2.8*(stall+.5),z=pad.minZ+3.5
 return {id:`motor-row-bay-${index}`,name:`Bay ${index}`,x,z,y:surfaceHeightAt(x,z),width:2.8,length:5.8,yaw:0}
}
/** Existing marked north-row stalls, separated by one unused stall; the entrance stays clear. */
export const GARAGE={
 id:'motor-row',name:'Motor Row Garage',buildingId:garage.id,
 terminal:{x:garage.x+8.5,z:garage.z+garage.depth/2+1.5,y:surfaceHeightAt(garage.x+8.5,garage.z+garage.depth/2+1.5),width:.7,depth:.45,height:1.6,range:2.7},
 bays:[bay(1,10),bay(2,12)] as readonly GarageParkingBay[],
}
