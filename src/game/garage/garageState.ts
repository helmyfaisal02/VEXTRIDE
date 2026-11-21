import { create } from 'zustand'
import type { RapierRigidBody } from '@react-three/rapier'
import { resetInput } from '../input/inputState'
import { useCharacterStore } from '../state/characterStore'
import { useVehicleStore,vehicleRuntime } from '../vehicles/vehicleState'
import { useDialogueStore } from '../interactions/dialogueState'
import type { VehicleId } from '../vehicles/vehicleConfig'
/** No duplicate vehicle transforms: only confirmed bay assignments and UI state. */
export const garageRuntime={terminal:null as RapierRigidBody|null}
export type ParkingOccupancy=Readonly<Record<string,VehicleId>>
export const useGarageStore=create<{
 open:boolean;hint:string;occupancy:ParkingOccupancy
 show:()=>boolean;close:()=>void;setHint:(hint:string)=>void;publish:(occupancy:ParkingOccupancy)=>void
}>((set,get)=>({
 open:false,hint:'',occupancy:{},
 show:()=>{
  if(get().open||useCharacterStore.getState().menuOpen||useDialogueStore.getState().active||useVehicleStore.getState().driving)return false
  resetInput();const player=vehicleRuntime.pedestrian
  if(player?.isValid()){const v=player.linvel();player.setLinvel({x:0,y:v.y,z:0},true)}
  set({open:true,hint:''});return true
 },
 close:()=>{resetInput();set({open:false,hint:''})},
 setHint:hint=>set(s=>s.hint===hint?s:{hint}),
 publish:occupancy=>{const old=get().occupancy;if(Object.keys(old).length!==Object.keys(occupancy).length||Object.keys(old).some(id=>old[id]!==occupancy[id]))set({occupancy})},
}))
