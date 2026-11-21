import type { BufferGeometry,MeshStandardMaterial } from 'three'
import { useMissionStore } from '../missions/missionState'
import type { VehicleId } from './vehicleConfig'
import { paintPreset,playerPaintSlots,preparePlayerPaint } from './vehiclePaint'
export function bindPlayerPaint(id:VehicleId,geometry:BufferGeometry,material:MeshStandardMaterial){
 preparePlayerPaint(geometry,material,id,useMissionStore.getState().economy.paints[id])
 playerPaintSlots.set(id,material)
 const unsubscribe=useMissionStore.subscribe((next,previous)=>{if(next.economy.paints[id]!==previous.economy.paints[id])material.color.set(paintPreset(id,next.economy.paints[id])!.color)})
 return ()=>{unsubscribe();if(playerPaintSlots.get(id)===material)playerPaintSlots.delete(id)}
}
