import { memo,useEffect,useRef,useState } from 'react'
import { CapsuleCollider,RigidBody,useBeforePhysicsStep,type RapierRigidBody } from '@react-three/rapier'
import { useFrame } from '@react-three/fiber'
import { MeshStandardMaterial,type Group } from 'three'
import { NPCS,npcHeight,type NPCDefinition } from './npcConfig'
import { npcRegistry } from './npcState'
import { createNPCGeometry,npcIdle } from './npcGeometry'
import { useDialogueStore } from '../interactions/dialogueState'
import { useCharacterStore } from '../state/characterStore'
import { useVehicleStore } from '../vehicles/vehicleState'
function NPC({definition:d,material}:{definition:NPCDefinition;material:MeshStandardMaterial}){
 const body=useRef<RapierRigidBody>(null),torso=useRef<Group>(null),head=useRef<Group>(null),left=useRef<Group>(null),right=useRef<Group>(null)
 const [geometry]=useState(()=>createNPCGeometry(d))
 useBeforePhysicsStep(()=>{if(body.current&&npcRegistry.get(d.id)?.body!==body.current)npcRegistry.set(d.id,{definition:d,body:body.current})})
 useEffect(()=>()=>{
  npcRegistry.delete(d.id)
  if(useDialogueStore.getState().active?.id===d.id)useDialogueStore.getState().close()
  Object.values(geometry).forEach(g=>g.dispose())
 },[d.id,geometry])
 useFrame(({clock})=>{
  const pose=npcIdle(clock.elapsedTime,d.id==='marcus'?0:1.7)
  if(torso.current)torso.current.scale.y=pose.breath
  if(head.current)head.current.rotation.y=pose.head
  if(left.current)left.current.rotation.x=pose.left
  if(right.current)right.current.rotation.x=pose.right
 })
 const h=npcHeight(d)
 return <RigidBody ref={body} name={`npc-${d.id}-body`} type="fixed" colliders={false} position={[d.spawn.x,d.spawn.y,d.spawn.z]} rotation={[0,d.yaw,0]}>
  <CapsuleCollider args={[h/2-d.radius,d.radius]} position={[0,h/2,0]}/>
  <group name={`npc-${d.id}`} scale={d.scale} dispose={null}>
   <mesh geometry={geometry.base} material={material} castShadow receiveShadow/>
   <group ref={torso} position={[0,1,0]}>
    <mesh geometry={geometry.torso} material={material} castShadow receiveShadow/>
    <group ref={head} position={[0,.55,0]}><mesh geometry={geometry.head} material={material} castShadow/></group>
    <group ref={left} position={[-.31,.40,0]}><mesh geometry={geometry.left} material={material} castShadow/></group>
    <group ref={right} position={[.31,.40,0]}><mesh geometry={geometry.right} material={material} castShadow/></group>
   </group>
  </group>
 </RigidBody>
}
function NPCSystemImpl(){
 const [material]=useState(()=>new MeshStandardMaterial({vertexColors:true,roughness:.85}))
 useEffect(()=>{
  const creator=useCharacterStore.subscribe(s=>{if(s.menuOpen&&useDialogueStore.getState().active)useDialogueStore.getState().close()})
  const vehicle=useVehicleStore.subscribe(s=>{if(s.driving&&useDialogueStore.getState().active)useDialogueStore.getState().close()})
  return ()=>{creator();vehicle();const dialogue=useDialogueStore.getState();if(dialogue.active)dialogue.close();else dialogue.setHint('');material.dispose()}
 },[material])
 return <>{NPCS.map(d=><NPC key={d.id} definition={d} material={material}/>)}</>
}
export const NPCSystem=memo(NPCSystemImpl)
