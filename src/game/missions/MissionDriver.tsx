import { useState } from 'react'
import { useAfterPhysicsStep } from '@react-three/rapier'
import { useCharacterStore } from '../state/characterStore'
import { useVehicleStore,getActiveVehicleRuntime } from '../vehicles/vehicleState'
import { bodyYaw } from '../vehicles/vehicleSim'
import { currentObjective,useMissionStore } from './missionState'
import type { VehicleSample } from './checkpointCrossing'
export function createCheckpointObserver(){
 let previous:VehicleSample|null=null,objective:string|null=null,bodyHandle:number|null=null
 return {
  reset(){previous=null;objective=null;bodyHandle=null},
  step(dt:number){
   const store=useMissionStore.getState(),o=currentObjective(store.progress),ownership=useVehicleStore.getState()
   if(!o?.checkpointId||!ownership.driving||useCharacterStore.getState().menuOpen){this.reset();return}
   const runtime=getActiveVehicleRuntime(),body=runtime.body
   if(!body?.isValid()){this.reset();return}
   const p=body.translation(),v=body.linvel(),q=body.rotation()
   const current:VehicleSample={vehicleId:runtime.definition.id,x:p.x,y:p.y,z:p.z,vx:v.x,vz:v.z,yaw:bodyYaw(body),up:1-2*(q.x*q.x+q.z*q.z),revision:runtime.state.recoveryRevision}
   if(previous&&objective===o.id&&bodyHandle===body.handle)store.transition({kind:'checkpoint',missionId:store.progress.missionId,objectiveId:o.id,previous,current,dt})
   previous=current;objective=o.id;bodyHandle=body.handle
  },
 }
}
/** Observe real occupied-body movement after the existing fixed Rapier step. No input or physics writes. */
export function MissionDriver(){
 const [observer]=useState(createCheckpointObserver)
 useAfterPhysicsStep(world=>observer.step(world.timestep))
 return null
}
