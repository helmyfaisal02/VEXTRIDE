import type { BufferGeometry,MeshStandardMaterial } from 'three'
import type { VehicleId } from './vehicleConfig'
export type PaintId='factory'|'ember'|'violet'
export interface PaintPreset{id:PaintId;name:string;color:string}
const alternatives:readonly PaintPreset[]=[{id:'ember',name:'Ember Red',color:'#e45d43'},{id:'violet',name:'Metro Violet',color:'#8059c9'}]
export const VEHICLE_PAINTS:Readonly<Record<VehicleId,readonly PaintPreset[]>>={
 'street-coupe':[{id:'factory',name:'Factory Teal',color:'#319ca7'},...alternatives],
 'city-sedan':[{id:'factory',name:'Factory Slate Blue',color:'#667da6'},...alternatives],
 'utility-pickup':[{id:'factory',name:'Factory Amber',color:'#c88a3f'},...alternatives],
}
export const paintPreset=(vehicleId:VehicleId,id:string)=>VEHICLE_PAINTS[vehicleId].find(p=>p.id===id)
/** Render references only. Cosmetic selection lives in the session store, not the material. */
export const playerPaintSlots=new Map<VehicleId,MeshStandardMaterial>()
/** Body builders contain paint only; glazing, trim and lamps are separate unchanged geometries.
 * Normalize baked body RGB once, then use the existing private body material as the paint slot.
 */
export function preparePlayerPaint(geometry:BufferGeometry,material:MeshStandardMaterial,vehicleId:VehicleId,paintId:PaintId){
 const colors=geometry.getAttribute('color')
 for(let i=0;i<colors.count;i++)colors.setXYZ(i,1,1,1)
 colors.needsUpdate=true
 material.color.set(paintPreset(vehicleId,paintId)!.color)
}
