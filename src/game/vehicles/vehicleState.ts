import { create } from 'zustand'
import { Vector3 } from 'three'
import type { RapierRigidBody } from '@react-three/rapier'
import { resetInput } from '../input/inputState'
import { COUPE, VEHICLES, getVehicleDefinition, type VehicleId, type VehicleDefinition } from './vehicleConfig'

/** Only discrete ownership/hint changes notify React. */
export const useVehicleStore = create<{
  driving: boolean; activeVehicleId: VehicleId | null; hint: string; recoveryHint: string
  setDriving: (driving: boolean, id?: VehicleId) => void; setRecoveryHint: (hint: string) => void; setHint: (hint: string) => void
}>((set)=>({
  driving:false,activeVehicleId:null,hint:'',recoveryHint:'',
  setDriving:(driving,id=COUPE.id)=>{resetInput();set({driving,activeVehicleId:driving?id:null,hint:'',recoveryHint:''})},
  setRecoveryHint:(recoveryHint)=>set(s=>s.recoveryHint===recoveryHint?s:{recoveryHint}),
  setHint:(hint)=>set(s=>s.hint===hint?s:{hint}),
}))
export function createVehicleState(definition: VehicleDefinition) {
  return {position:new Vector3(definition.spawn.x,definition.spawn.y,definition.spawn.z),yaw:definition.spawnYaw,speed:0,steering:0,wheelRoll:0,grounded:false,recoveryRevision:0,restorationRevision:0}
}
export const vehicleRegistry = new Map(VEHICLES.map(definition=>[definition.id,{definition,body:null as RapierRigidBody|null,state:createVehicleState(definition)}]))
export const getVehicleRuntime = (id: VehicleId) => vehicleRegistry.get(id)!
export const getActiveVehicleDefinition = () => getVehicleDefinition(useVehicleStore.getState().activeVehicleId ?? COUPE.id)
export const getActiveVehicleRuntime = () => getVehicleRuntime(useVehicleStore.getState().activeVehicleId ?? COUPE.id)

/** Active read view retains the existing player/camera consumers and coupe test API. */
export const vehicleState = {
  get position(){return getActiveVehicleRuntime().state.position},
  get yaw(){return getActiveVehicleRuntime().state.yaw},
  get speed(){return getActiveVehicleRuntime().state.speed},
  get steering(){return getActiveVehicleRuntime().state.steering},
  get wheelRoll(){return getActiveVehicleRuntime().state.wheelRoll},
  get grounded(){return getActiveVehicleRuntime().state.grounded},
}
/** body refers to the occupied body, or the original coupe when walking. */
export const vehicleRuntime = {
  get body(): RapierRigidBody|null {return getActiveVehicleRuntime().body},
  set body(body: RapierRigidBody|null){getActiveVehicleRuntime().body=body},
  pedestrian:null as RapierRigidBody|null,
}
