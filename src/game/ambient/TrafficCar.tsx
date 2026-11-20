import { memo,useEffect,useRef,useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider,RigidBody,useBeforePhysicsStep,useRapier,type RapierRigidBody } from '@react-three/rapier'
import { Color,type Group } from 'three'
import { createVehicleAssets } from '../vehicles/Vehicle'
import { vehicleWheels } from '../vehicles/vehicleConfig'
import type { SharedVehicleMaterials } from '../vehicles/modelPrimitives'
import { worldLighting } from '../world/dayNight'
import { ROAD_TOP } from '../city/cityConfig'
import type { TrafficDefinition } from './ambientConfig'
import { createTrafficSim,stepTraffic } from './ambientSim'
import { createRoutePose,sampleRoute } from './ambientRoutes'
import { ambientBodies,ambientTraffic } from './ambientState'
function TrafficCarImpl({definition:d,shared}:{definition:TrafficDefinition;shared:SharedVehicleMaterials}){
 const physics=useRapier(),body=useRef<RapierRigidBody>(null)
 const [spawn]=useState(()=>sampleRoute(d.route,d.start,createRoutePose()))
 const [sim]=useState(()=>createTrafficSim(physics,d)),state=useRef(sim)
 const [wheels]=useState(()=>vehicleWheels(d.vehicle)),steer=useRef<Array<Group|null>>([]),roll=useRef<Array<Group|null>>([])
 const [assets]=useState(()=>{
  const a=createVehicleAssets(d.vehicle),color=new Color(d.paint),attribute=a.geometries.body.getAttribute('color')
  for(let i=0;i<attribute.count;i++)attribute.setXYZ(i,color.r,color.g,color.b)
  for(const key of['body','glass','trim','tire']as const){a.materials[key].dispose();a.materials[key]=shared[key]}
  return a
 })
 const mutable=useRef(assets)
 useEffect(()=>()=>{ambientBodies.delete(d.id);ambientTraffic.delete(d.id);Object.values(assets.geometries).forEach(g=>g.dispose());assets.materials.head.dispose();assets.materials.tail.dispose()},[d.id,assets])
 useBeforePhysicsStep(()=>{
  if(!body.current)return
  if(!ambientBodies.has(d.id)){ambientBodies.set(d.id,body.current);ambientTraffic.set(d.id,state.current)}
  stepTraffic(physics,body.current,state.current,d,1/60)
 })
 useFrame(()=>{
  steer.current.forEach((g,i)=>{if(g)g.rotation.y=wheels[i].front?state.current.steer:0})
  roll.current.forEach(g=>{if(g)g.rotation.x=state.current.roll})
  mutable.current.materials.head.emissiveIntensity=.15+worldLighting.night*.8
  mutable.current.materials.tail.emissiveIntensity=state.current.braking?1.8:.25+worldLighting.night*.4
 })
 const v=d.vehicle
 return <RigidBody ref={body} type="kinematicPosition" colliders={false} name={d.id} position={[spawn.x,ROAD_TOP+v.rideHeight,spawn.z]} rotation={[0,spawn.yaw,0]}>
  <CuboidCollider args={[v.width/2,v.height/2,v.length/2]} position={[0,v.height/2-v.rideHeight,0]} friction={0} restitution={0}/>
  <group name={`${d.id}-visual`} dispose={null}>
   {(['body','glass','trim','head','tail']as const).map(part=><mesh key={part} geometry={assets.geometries[part]} material={assets.materials[part]} receiveShadow/>)}
   {wheels.map((w,i)=><group key={i} ref={g=>{steer.current[i]=g}} position={[w.x,v.wheelRadius-v.rideHeight,w.z]} name={`${d.id}-wheel-${i}`}><group ref={g=>{roll.current[i]=g}}><mesh geometry={assets.geometries.tire} material={assets.materials.tire} rotation={[0,0,Math.PI/2]}/><mesh geometry={assets.geometries.spokes} material={assets.materials.trim}/></group></group>)}
  </group>
 </RigidBody>
}
export const TrafficCar=memo(TrafficCarImpl)
