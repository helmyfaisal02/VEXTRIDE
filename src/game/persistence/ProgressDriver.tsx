import { useLayoutEffect,useMemo } from 'react'
import { useAfterPhysicsStep,useRapier } from '@react-three/rapier'
import { guestPersistence,type createPersistenceCoordinator } from './persistenceCoordinator'
export function ProgressDriver({coordinator=guestPersistence}:{coordinator?:ReturnType<typeof createPersistenceCoordinator>}){
 const {world,rapier}=useRapier(),physics=useMemo(()=>({world,rapier}),[world,rapier])
 useLayoutEffect(()=>coordinator.connect(physics,typeof window==='undefined'?undefined:{window,document}),[coordinator,physics])
 useAfterPhysicsStep(world=>coordinator.step(physics,world.timestep))
 return null
}
