import { memo, useEffect, useRef, useState } from 'react'
import { BallCollider, CuboidCollider, CoefficientCombineRule, RigidBody, useBeforePhysicsStep, useRapier, type RapierRigidBody } from '@react-three/rapier'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { inputState } from '../input/inputState'
import { FIXED_DT } from '../character/config'
import { useCharacterStore } from '../state/characterStore'
import { worldLighting } from '../world/dayNight'
import { createCoupeAssets } from './coupeGeometry'
import { COUPE, WHEELS, CHASSIS_COLLIDERS } from './vehicleConfig'
import { bodyYaw, createVehicleSim, stepVehicle } from './vehicleSim'
import { processVehicleInteraction } from './vehicleInteraction'
import { useVehicleStore, vehicleRuntime, vehicleState } from './vehicleState'

function StreetCoupeImpl() {
  const physics = useRapier()
  const body = useRef<RapierRigidBody>(null), visual = useRef<Group>(null)
  const wheels = useRef<Array<Group | null>>([]), rolls = useRef<Array<Group | null>>([])
  const sim = useRef(createVehicleSim(physics.rapier))
  const [assets] = useState(createCoupeAssets)
  const mutableAssets = useRef(assets)
  useEffect(() => () => {
    vehicleRuntime.body = null
    for (const g of Object.values(assets.geometries)) g.dispose()
    for (const m of Object.values(assets.materials)) m.dispose()
  }, [assets])
  useBeforePhysicsStep(() => {
    if (!body.current) return
    vehicleRuntime.body = body.current
    if (!useCharacterStore.getState().menuOpen) processVehicleInteraction(physics)
    stepVehicle(sim.current, physics, body.current, inputState, useVehicleStore.getState().driving && !useCharacterStore.getState().menuOpen, FIXED_DT)
  })
  useFrame(() => {
    if (!body.current || !visual.current) return
    visual.current.getWorldPosition(vehicleState.position)
    vehicleState.yaw = bodyYaw(body.current)
    const v = body.current.linvel()
    vehicleState.speed = -Math.sin(vehicleState.yaw) * v.x - Math.cos(vehicleState.yaw) * v.z
    vehicleState.steering = sim.current.steering
    vehicleState.wheelRoll = sim.current.roll
    vehicleState.grounded = sim.current.grounded
    wheels.current.forEach((wheel, i) => { if (wheel) wheel.rotation.y = WHEELS[i].front ? sim.current.steering : 0 })
    rolls.current.forEach((wheel) => { if (wheel) wheel.rotation.x = sim.current.roll })
    mutableAssets.current.materials.head.emissiveIntensity = .15 + worldLighting.night * .8
    mutableAssets.current.materials.tail.emissiveIntensity = inputState.backward && useVehicleStore.getState().driving ? 1.8 : .25 + worldLighting.night * .4
  }, -11)
  return (
    <RigidBody ref={body} name="street-coupe-body" colliders={false} position={[COUPE.spawn.x,COUPE.spawn.y,COUPE.spawn.z]} rotation={[0,COUPE.spawnYaw,0]} enabledRotations={[false,true,false]} ccd canSleep={false} angularDamping={2}>
      {CHASSIS_COLLIDERS.map((c,i) => <CuboidCollider key={i} args={c.half} position={c.position} mass={c.mass} friction={.05} frictionCombineRule={CoefficientCombineRule.Min} restitution={0} />)}
      {WHEELS.map((wheel, i) => <BallCollider key={i} args={[.28]} position={[Math.sign(wheel.x)*.64,-.22,wheel.z]} mass={25} friction={.05} frictionCombineRule={CoefficientCombineRule.Min} restitution={0} />)}
      <group ref={visual} name="vextride-street-coupe">
        {(['body','glass','trim','head','tail'] as const).map((part) => <mesh key={part} geometry={assets.geometries[part]} material={assets.materials[part]} castShadow receiveShadow />)}
        {WHEELS.map((wheel,i) => (
          <group key={i} ref={(node) => { wheels.current[i] = node }} position={[wheel.x,-.18,wheel.z]} name={`coupe-wheel-${i}`}>
            <group ref={(node) => { rolls.current[i] = node }}>
              <mesh geometry={assets.geometries.tire} material={assets.materials.tire} rotation={[0,0,Math.PI/2]} castShadow />
              <mesh geometry={assets.geometries.spokes} material={assets.materials.trim} castShadow />
            </group>
          </group>
        ))}
      </group>
    </RigidBody>
  )
}
export const StreetCoupe = memo(StreetCoupeImpl)
