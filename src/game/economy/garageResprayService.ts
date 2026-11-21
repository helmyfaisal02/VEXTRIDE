import { VEHICLES,type VehicleId } from '../vehicles/vehicleConfig'
import { vehicleRegistry,useVehicleStore,vehicleRuntime } from '../vehicles/vehicleState'
import { paintPreset,playerPaintSlots } from '../vehicles/vehiclePaint'
import { useGarageStore,garageRuntime } from '../garage/garageState'
import { canServiceParkedVehicle } from '../garage/parkingDetector'
import { useCharacterStore } from '../state/characterStore'
import { useDialogueStore } from '../interactions/dialogueState'
import { STREET_CASH } from './economyConfig'
import type { EconomySnapshot } from './economyState'
import { transact,type EconomyResult } from './economyTransactions'
export interface ResprayRequest{operationId:string;vehicleId:string;paintId:string}
let operationSequence=0
export const newResprayOperationId=()=>`respray:${++operationSequence}`
/** One synchronous guarded logical purchase; caller commits paint and ledger in one store write. */
export function respray(economy:EconomySnapshot,request:ResprayRequest):EconomyResult{
 if(!VEHICLES.some(v=>v.id===request.vehicleId))return {ok:false,message:'Choose an existing playable vehicle.'}
 const id=request.vehicleId as VehicleId,preset=paintPreset(id,request.paintId)
 if(!preset)return {ok:false,message:'Choose a valid paint preset.'}
 const body=vehicleRegistry.get(id)?.body
 if(!body?.isValid()||!playerPaintSlots.has(id))return {ok:false,message:'This vehicle is not available in the current world.'}
 if(!useGarageStore.getState().open||useVehicleStore.getState().driving||useCharacterStore.getState().menuOpen||useDialogueStore.getState().active||!vehicleRuntime.pedestrian?.isValid()||!vehicleRuntime.pedestrian.isEnabled()||!garageRuntime.terminal?.isValid()||!canServiceParkedVehicle(id,vehicleRuntime.pedestrian))return {ok:false,message:'Park this vehicle fully in a garage bay, stop and exit before using the terminal.'}
 if(economy.paints[id]===preset.id)return {ok:false,message:'This vehicle already has that color. No Street Cash spent.'}
 if(economy.balance<STREET_CASH.resprayPrice)return {ok:false,message:`Insufficient Street Cash — respray costs ${STREET_CASH.resprayPrice} SC; balance ${economy.balance} SC.`}
 if(!/^respray:[1-9]\d*$/.test(request.operationId))return {ok:false,message:'Invalid respray operation.'}
 const result=transact(economy,{id:request.operationId,type:'SPEND',amount:STREET_CASH.resprayPrice,reason:`Body respray — ${preset.name}`,vehicleId:id,paintId:preset.id})
 return result.ok?{ok:true,economy:{...result.economy,paints:{...economy.paints,[id]:preset.id}}}:result
}
