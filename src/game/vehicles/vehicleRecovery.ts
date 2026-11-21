import type { useRapier, RapierRigidBody,RapierCollider } from '@react-three/rapier'
import { inputState, resetInput } from '../input/inputState'
import { GROUND_SIZE } from '../shared/constants'
import { vehicleWheels, type VehicleDefinition } from './vehicleConfig'
import { bodyYaw, type VehicleSim } from './vehicleSim'
import { getVehicleRuntime, useVehicleStore } from './vehicleState'

type Physics = Pick<ReturnType<typeof useRapier>, 'world' | 'rapier'>
export interface RecoveryPose { x: number; y: number; z: number; yaw: number }
export function vehicleUp(body: RapierRigidBody) {
  const q=body.rotation()
  return 1-2*(q.x*q.x+q.z*q.z)
}
export function createRecoveryState() {
  return {lastSafe:null as RecoveryPose|null,previous:null as {x:number;z:number}|null,blocked:0,stuckGrace:0,overturned:0,held:0,sample:0,messageTime:0,eligible:false}
}
export type RecoveryState=ReturnType<typeof createRecoveryState>

/** Validate support and each actual chassis/runner shape, including other dynamic cars.
 * A small clearance skin rejects wall-adjacent checkpoints; sensors/self are ignored.
 * A ground ray cannot promote a building roof to a recovery surface.
 */
export function safeRecoveryPose(physics:Physics,body:RapierRigidBody,d:VehicleDefinition,pose:RecoveryPose,filter?:(collider:RapierCollider)=>boolean):RecoveryPose|null {
  if(!Object.values(pose).every(Number.isFinite)||Math.abs(pose.x)>GROUND_SIZE/2-d.length||Math.abs(pose.z)>GROUND_SIZE/2-d.length)return null
  const c=Math.cos(pose.yaw),s=Math.sin(pose.yaw),ground=pose.y-d.rideHeight
  const flags=physics.rapier.QueryFilterFlags.EXCLUDE_SENSORS
  let lo=Infinity,hi=-Infinity
  for(const point of [{x:0,z:0},...vehicleWheels(d)]) {
    const x=pose.x+c*point.x+s*point.z,z=pose.z-s*point.x+c*point.z
    const hit=physics.world.castRayAndGetNormal(new physics.rapier.Ray({x,y:ground+.65,z},{x:0,y:-1,z:0}),1.3,true,flags,undefined,undefined,body,filter)
    if(!hit||hit.normal.y<.85||hit.collider.parent()?.isDynamic())return null
    const y=ground+.65-hit.timeOfImpact
    if(Math.abs(y-ground)>.35)return null
    lo=Math.min(lo,y);hi=Math.max(hi,y)
  }
  if(hi-lo>.18)return null
  const result={...pose,y:hi+d.rideHeight+.04}
  const q={x:0,y:Math.sin(pose.yaw/2),z:0,w:Math.cos(pose.yaw/2)}
  const clear=(x:number,y:number,z:number,shape:InstanceType<Physics['rapier']['Cuboid']>|InstanceType<Physics['rapier']['Ball']>)=>!physics.world.intersectionWithShape({x:result.x+c*x+s*z,y:result.y+y,z:result.z-s*x+c*z},q,shape,flags,undefined,undefined,body,filter)
  for(const collider of d.colliders)if(!clear(...collider.position,new physics.rapier.Cuboid(...collider.half.map(v=>v+.04) as [number,number,number])))return null
  for(const x of[-d.probeTrack,d.probeTrack])for(const z of[-d.wheelbase/2,d.wheelbase/2])if(!clear(x,d.runnerRadius-d.rideHeight,z,new physics.rapier.Ball(d.runnerRadius)))return null
  return result
}

/** Fixed-step, active vehicle only. Holding R during ordinary driving never moves it. */
export function stepRecovery(state:RecoveryState,physics:Physics,body:RapierRigidBody,d:VehicleDefinition,sim:VehicleSim,occupied:boolean,dt:number):boolean {
  if(!occupied){state.held=state.blocked=state.stuckGrace=state.overturned=0;state.previous=null;state.eligible=false;return false}
  const p=body.translation(),v=body.linvel(),speed=Math.hypot(v.x,v.z),up=vehicleUp(body)
  const moved=state.previous?Math.hypot(p.x-state.previous.x,p.z-state.previous.z):Infinity
  state.previous={x:p.x,z:p.z}
  state.overturned=up<.35&&speed<2&&Math.abs(v.y)<1?state.overturned+dt:0
  const trying=inputState.forward!==inputState.backward&&!inputState.jumpHeld
  state.blocked=trying&&moved<.3*dt&&speed<.6&&Math.abs(v.y)<.5?state.blocked+dt:0
  // Allow releasing throttle to read the hint/hold R. Driving away cancels this window.
  state.stuckGrace=speed>.6||Math.abs(v.y)>.5?0:Math.max(0,state.stuckGrace-dt)
  if(state.blocked>=3)state.stuckGrace=3
  state.eligible=state.overturned>=.6||state.stuckGrace>0
  state.sample+=dt
  if(up>.95&&sim.grounded&&state.sample>=.5&&!state.eligible){
    state.sample=0
    const safe=safeRecoveryPose(physics,body,d,{...p,yaw:bodyYaw(body)})
    if(safe)state.lastSafe=safe
  }
  state.messageTime=Math.max(0,state.messageTime-dt)
  const store=useVehicleStore.getState()
  if(state.eligible){
    state.held=inputState.recoveryHeld?state.held+dt:0
    if(state.messageTime===0)store.setRecoveryHint(state.held>0?'Recovering — keep holding R':'Vehicle stuck — hold R for 1 second to recover')
    if(state.held>=1){
      const fallback={...d.spawn,yaw:d.spawnYaw}
      const target=(state.lastSafe&&safeRecoveryPose(physics,body,d,state.lastSafe))||safeRecoveryPose(physics,body,d,fallback)
      resetInput();state.held=0;state.messageTime=3
      if(!target){store.setRecoveryHint('Recovery blocked — no safe location available');return false}
      body.setTranslation(target,true)
      body.setRotation({x:0,y:Math.sin(target.yaw/2),z:0,w:Math.cos(target.yaw/2)},true)
      body.setLinvel({x:0,y:0,z:0},true);body.setAngvel({x:0,y:0,z:0},true)
      sim.previous=null;sim.acceleration=sim.steering=sim.handbrake=sim.idleTime=0
      state.previous=null;state.blocked=state.stuckGrace=state.overturned=0;state.eligible=false
      getVehicleRuntime(d.id).state.recoveryRevision++
      store.setRecoveryHint('Vehicle recovered — controls reset')
      return true
    }
  }else{
    state.held=0
    if(state.messageTime===0)store.setRecoveryHint('')
  }
  return false
}
