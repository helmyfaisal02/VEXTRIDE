import { memo,useEffect,useRef,useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { CapsuleCollider,RigidBody,useBeforePhysicsStep,useRapier,type RapierRigidBody } from '@react-three/rapier'
import { CharacterModel } from '../character/CharacterModel'
import { createCharacterRig } from '../character/characterRig'
import { createPose,groundPose } from '../character/characterPoses'
import { surfaceHeightAt } from '../city/citySurface'
import type { PedestrianDefinition } from './ambientConfig'
import { createPedestrianSim,stepPedestrian } from './ambientSim'
import { ambientBodies,ambientWalkers } from './ambientState'
function AmbientPedestrianImpl({definition:d}:{definition:PedestrianDefinition}){
 const physics=useRapier(),body=useRef<RapierRigidBody>(null)
 const [sim]=useState(()=>createPedestrianSim(physics,d)),state=useRef(sim),[rig]=useState(createCharacterRig),[pose]=useState(createPose),animated=useRef(pose)
 const activeRig=useRef(rig)
 useEffect(()=>()=>{ambientBodies.delete(d.id);ambientWalkers.delete(d.id)},[d.id])
 useBeforePhysicsStep(()=>{
  if(!body.current)return
  if(!ambientBodies.has(d.id)){ambientBodies.set(d.id,body.current);ambientWalkers.set(d.id,state.current)}
  stepPedestrian(physics,body.current,state.current,d,1/60)
 })
 useFrame(()=>{
  const rig=activeRig.current
  const p=groundPose(animated.current,state.current.phase,state.current.move,0,state.current.time)
  if(rig.hips.current)rig.hips.current.position.y=.95+p.hipsY
  rig.legL.current?.rotation.set(p.legL,0,0);rig.legR.current?.rotation.set(p.legR,0,0)
  rig.kneeL.current?.rotation.set(p.kneeL,0,0);rig.kneeR.current?.rotation.set(p.kneeR,0,0)
  rig.armL.current?.rotation.set(p.armL,0,p.armOut);rig.armR.current?.rotation.set(p.armR,0,-p.armOut)
  rig.elbowL.current?.rotation.set(p.elbow,0,0);rig.elbowR.current?.rotation.set(p.elbow,0,0)
  rig.torso.current?.rotation.set(p.torsoX,p.torsoY,0);rig.head.current?.rotation.set(p.headX,p.headY,0)
 })
 const start=d.points[0]
 return <RigidBody ref={body} type="kinematicPosition" colliders={false} name={d.id} position={[start.x,surfaceHeightAt(start.x,start.z)+.93,start.z]} rotation={[0,Math.atan2(d.points[1].x-start.x,d.points[1].z-start.z),0]}>
  <CapsuleCollider args={[.6,.3]} friction={0} restitution={0}/>
  <group name={`${d.id}-visual`} position={[0,-.93,0]}><CharacterModel rig={rig} appearance={d.appearance}/></group>
 </RigidBody>
}
export const AmbientPedestrian=memo(AmbientPedestrianImpl)
