import { memo, useEffect, useRef, useState } from 'react'
import { BallCollider, CuboidCollider, CoefficientCombineRule, RigidBody, useBeforePhysicsStep, useRapier, type RapierRigidBody } from '@react-three/rapier'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { inputState } from '../input/inputState'
import { FIXED_DT } from '../character/config'
import { useCharacterStore } from '../state/characterStore'
import { worldLighting } from '../world/dayNight'
import { createCoupeAssets } from './coupeGeometry'
import { createSedanAssets } from './sedanGeometry'
import { createPickupAssets } from './pickupGeometry'
import type { SharedVehicleMaterials } from './modelPrimitives'
import { vehicleWheels, type VehicleDefinition } from './vehicleConfig'
import { bodyYaw, createVehicleSim, stepVehicle } from './vehicleSim'
import { getVehicleRuntime, useVehicleStore } from './vehicleState'

export function createVehicleAssets(definition: VehicleDefinition) {
  return definition.modelType==='coupe' ? createCoupeAssets() : definition.modelType==='sedan' ? createSedanAssets() : createPickupAssets()
}
function VehicleImpl({definition,shared}: {definition:VehicleDefinition;shared:SharedVehicleMaterials}) {
  const physics=useRapier(),body=useRef<RapierRigidBody>(null),visual=useRef<Group>(null)
  const steerGroups=useRef<Array<Group|null>>([]),rollGroups=useRef<Array<Group|null>>([])
  const sim=useRef(createVehicleSim(physics.rapier)),runtime=useRef(getVehicleRuntime(definition.id))
  const [wheels]=useState(()=>vehicleWheels(definition))
  const [assets]=useState(()=>{
    const result=createVehicleAssets(definition)
    for(const key of ['body','glass','trim','tire'] as const){result.materials[key].dispose();result.materials[key]=shared[key]}
    return result
  })
  const mutableAssets=useRef(assets)
  useEffect(()=>()=>{
    runtime.current.body=null
    for(const g of Object.values(assets.geometries))g.dispose()
    assets.materials.head.dispose();assets.materials.tail.dispose()
  },[assets])
  useBeforePhysicsStep(()=>{
    if(!body.current)return
    runtime.current.body=body.current
    const state=useVehicleStore.getState()
    const occupied=state.driving&&state.activeVehicleId===definition.id&&!useCharacterStore.getState().menuOpen
    stepVehicle(sim.current,physics,body.current,inputState,occupied,FIXED_DT,definition)
  })
  useFrame(()=>{
    if(!body.current||!visual.current)return
    const data=runtime.current.state
    visual.current.getWorldPosition(data.position)
    data.yaw=bodyYaw(body.current)
    const v=body.current.linvel()
    data.speed=-Math.sin(data.yaw)*v.x-Math.cos(data.yaw)*v.z
    data.steering=sim.current.steering;data.wheelRoll=sim.current.roll;data.grounded=sim.current.grounded
    steerGroups.current.forEach((wheel,i)=>{if(wheel)wheel.rotation.y=wheels[i].front?sim.current.steering:0})
    rollGroups.current.forEach(wheel=>{if(wheel)wheel.rotation.x=sim.current.roll})
    const active=useVehicleStore.getState().activeVehicleId===definition.id
    mutableAssets.current.materials.head.emissiveIntensity=.15+worldLighting.night*.8
    mutableAssets.current.materials.tail.emissiveIntensity=active&&inputState.backward?1.8:.25+worldLighting.night*.4
  },-11)
  return <RigidBody ref={body} name={`${definition.id}-body`} colliders={false} position={[definition.spawn.x,definition.spawn.y,definition.spawn.z]} rotation={[0,definition.spawnYaw,0]} enabledRotations={[false,true,false]} ccd canSleep angularDamping={2}>
    {definition.colliders.map((c,i)=><CuboidCollider key={i} args={c.half} position={c.position} mass={c.mass} friction={.05} frictionCombineRule={CoefficientCombineRule.Min} restitution={0}/>)}
    {wheels.map((wheel,i)=><BallCollider key={i} args={[definition.runnerRadius]} position={[Math.sign(wheel.x)*definition.probeTrack,definition.runnerRadius-definition.rideHeight,wheel.z]} mass={definition.wheelMass} friction={.05} frictionCombineRule={CoefficientCombineRule.Min} restitution={0}/>)}
    <group ref={visual} name={`vextride-${definition.id}`}>
      {(['body','glass','trim','head','tail'] as const).map(part=><mesh key={part} geometry={assets.geometries[part]} material={assets.materials[part]} castShadow receiveShadow/>)}
      {wheels.map((wheel,i)=><group key={i} ref={node=>{steerGroups.current[i]=node}} position={[wheel.x,definition.wheelRadius-definition.rideHeight,wheel.z]} name={`${definition.modelType}-wheel-${i}`}>
        <group ref={node=>{rollGroups.current[i]=node}}>
          <mesh geometry={assets.geometries.tire} material={assets.materials.tire} rotation={[0,0,Math.PI/2]} castShadow/>
          <mesh geometry={assets.geometries.spokes} material={assets.materials.trim} castShadow/>
        </group>
      </group>)}
    </group>
  </RigidBody>
}
export const Vehicle=memo(VehicleImpl)
