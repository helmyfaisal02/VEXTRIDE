import { memo,useEffect,useRef,useState } from 'react'
import { CuboidCollider,RigidBody,useBeforePhysicsStep,useAfterPhysicsStep,useRapier,type RapierRigidBody } from '@react-three/rapier'
import { MeshStandardMaterial,MeshBasicMaterial } from 'three'
import { GARAGE } from './garageConfig'
import { garageRuntime,useGarageStore } from './garageState'
import { createGarageGeometry } from './garageGeometry'
import { createParkingDetector } from './parkingDetector'
import { useCharacterStore } from '../state/characterStore'
import { useVehicleStore } from '../vehicles/vehicleState'
import { useDialogueStore } from '../interactions/dialogueState'
function GarageSystemImpl(){
 const physics=useRapier(),body=useRef<RapierRigidBody>(null),[detector]=useState(createParkingDetector)
 const [assets]=useState(()=>({geometry:createGarageGeometry(),shell:new MeshStandardMaterial({vertexColors:true,roughness:.8}),screen:new MeshBasicMaterial({vertexColors:true}),paint:new MeshBasicMaterial({vertexColors:true})}))
 useBeforePhysicsStep(()=>{if(body.current)garageRuntime.terminal=body.current})
 useAfterPhysicsStep(world=>detector.step(physics,world.timestep))
 useEffect(()=>{
  const close=()=>{if(useGarageStore.getState().open)useGarageStore.getState().close()}
  const creator=useCharacterStore.subscribe(s=>{if(s.menuOpen)close()})
  const vehicle=useVehicleStore.subscribe(s=>{if(s.driving)close()})
  const dialogue=useDialogueStore.subscribe(s=>{if(s.active)close()})
  return ()=>{creator();vehicle();dialogue();close();useGarageStore.getState().setHint('');detector.clear();garageRuntime.terminal=null;Object.values(assets.geometry).forEach(g=>g.dispose());assets.shell.dispose();assets.screen.dispose();assets.paint.dispose()}
 },[assets,detector])
 const t=GARAGE.terminal
 return <>
  <RigidBody ref={body} name="garage-terminal-body" type="fixed" colliders={false} position={[t.x,t.y,t.z]}>
   <CuboidCollider args={[t.width/2,t.height/2,t.depth/2]} position={[0,t.height/2,0]}/>
   <group name="garage-service-terminal" dispose={null}><mesh geometry={assets.geometry.shell} material={assets.shell} receiveShadow/><mesh geometry={assets.geometry.screen} material={assets.screen}/></group>
  </RigidBody>
  <mesh name="garage-parking-markers" geometry={assets.geometry.paint} material={assets.paint} dispose={null}/>
 </>
}
export const GarageSystem=memo(GarageSystemImpl)
