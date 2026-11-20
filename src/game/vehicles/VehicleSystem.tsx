import { memo,useEffect,useState } from 'react'
import { useBeforePhysicsStep,useRapier } from '@react-three/rapier'
import { useCharacterStore } from '../state/characterStore'
import { createSharedVehicleMaterials } from './modelPrimitives'
import { processVehicleInteraction } from './vehicleInteraction'
import { VEHICLES,type VehicleDefinition } from './vehicleConfig'
import { Vehicle } from './Vehicle'

function VehicleSystemImpl({definitions=VEHICLES}:{definitions?:readonly VehicleDefinition[]}) {
  const physics=useRapier()
  const [shared]=useState(createSharedVehicleMaterials)
  useEffect(()=>()=>{Object.values(shared).forEach(material=>material.dispose())},[shared])
  useBeforePhysicsStep(()=>{if(!useCharacterStore.getState().menuOpen)processVehicleInteraction(physics)})
  return <>{definitions.map(definition=><Vehicle key={definition.id} definition={definition} shared={shared}/>)}</>
}
export const VehicleSystem=memo(VehicleSystemImpl)
