import type { useRapier } from '@react-three/rapier'
import { VEHICLES,type VehicleDefinition } from '../vehicles/vehicleConfig'
import { vehicleRegistry,useVehicleStore } from '../vehicles/vehicleState'
import { safeRecoveryPose,vehicleUp } from '../vehicles/vehicleRecovery'
import { bodyYaw } from '../vehicles/vehicleSim'
import { surfaceHeightAt } from '../city/citySurface'
import { queueRestoredParking } from '../garage/parkingDetector'
import { resetInput } from '../input/inputState'
import type { SavedVehiclePose,SavedParking } from './persistenceSchema'
import { plausiblePose } from './persistenceValidation'
type Physics=Pick<ReturnType<typeof useRapier>,'world'|'rapier'>
export const defaultVehiclePoses=():SavedVehiclePose[]=>VEHICLES.map(d=>({vehicleId:d.id,...d.spawn,yaw:d.spawnYaw,layoutVersion:1}))
export function footprintOverlap(a:SavedVehiclePose,da:VehicleDefinition,b:SavedVehiclePose,db:VehicleDefinition){
 const axes=(p:SavedVehiclePose)=>[{x:Math.cos(p.yaw),z:-Math.sin(p.yaw)},{x:Math.sin(p.yaw),z:Math.cos(p.yaw)}]
 const aa=axes(a),bb=axes(b)
 for(const axis of [...aa,...bb]){
  const dot=(v:{x:number;z:number})=>Math.abs(v.x*axis.x+v.z*axis.z)
  const radius=da.width/2*dot(aa[0])+da.length/2*dot(aa[1])+db.width/2*dot(bb[0])+db.length/2*dot(bb[1])+.12
  if(Math.abs((a.x-b.x)*axis.x+(a.z-b.z)*axis.z)>radius)return false
 }
 return true
}
export function captureSafeVehiclePoses(physics:Physics,previous:readonly SavedVehiclePose[]){
 return VEHICLES.map(d=>{
  const r=vehicleRegistry.get(d.id)!,body=r.body,p=body?.isValid()?body.translation():null
  const pose=p&&body?{vehicleId:d.id,...p,yaw:bodyYaw(body),layoutVersion:1 as const}:null
  if(pose&&body&&vehicleUp(body)>.95&&plausiblePose(pose)&&safeRecoveryPose(physics,body,d,{x:pose.x,y:pose.y,z:pose.z,yaw:pose.yaw}))return pose
  return previous.find(p=>p.vehicleId===d.id)??defaultVehiclePoses().find(p=>p.vehicleId===d.id)!
 })
}
/** Validate static/dynamic clearance in the actual world, then resolve inter-car footprints as a group. */
export function restoreVehiclePoses(physics:Physics,saved:readonly SavedVehiclePose[],parking:readonly SavedParking[]){
 if(!VEHICLES.every(d=>vehicleRegistry.get(d.id)?.body?.isValid()))return null
 const handles=new Set(VEHICLES.map(d=>vehicleRegistry.get(d.id)!.body!.handle))
 const filter=(c:Parameters<NonNullable<Parameters<typeof safeRecoveryPose>[4]>>[0])=>!handles.has(c.parent()?.handle??-1)
 const defaults=defaultVehiclePoses(),fallback=new Set<string>()
 const checked=(d:VehicleDefinition,pose:SavedVehiclePose)=>{
  if(!plausiblePose(pose)||Math.abs(pose.y-d.rideHeight-surfaceHeightAt(pose.x,pose.z))>=.2)return null
  const valid=safeRecoveryPose(physics,vehicleRegistry.get(d.id)!.body!,d,{x:pose.x,y:pose.y,z:pose.z,yaw:pose.yaw},filter)
  return valid?{...pose,...valid}:null
 }
 const plans=VEHICLES.map(d=>{
  const pose=saved.find(p=>p.vehicleId===d.id),valid=pose&&checked(d,pose)
  if(valid)return valid
  fallback.add(d.id);return checked(d,defaults.find(p=>p.vehicleId===d.id)!)
 })
 if(plans.some(p=>!p))return null // Never force a blocked fallback; retry after the world settles.
 const poses=plans as SavedVehiclePose[]
 for(let pass=0;pass<3;pass++)for(let i=0;i<3;i++)for(let j=i+1;j<3;j++)if(footprintOverlap(poses[i],VEHICLES[i],poses[j],VEHICLES[j])){
  for(const n of [i,j]){fallback.add(VEHICLES[n].id);const valid=checked(VEHICLES[n],defaults[n]);if(!valid)return null;poses[n]=valid}
 }
 if(poses.some((p,i)=>poses.some((q,j)=>i!==j&&footprintOverlap(p,VEHICLES[i],q,VEHICLES[j]))))return null
 resetInput();useVehicleStore.getState().setDriving(false)
 for(const pose of poses){
  const r=vehicleRegistry.get(pose.vehicleId)!,body=r.body!
  body.setEnabled(true);body.setTranslation(pose,true);body.setRotation({x:0,y:Math.sin(pose.yaw/2),z:0,w:Math.cos(pose.yaw/2)},true)
  body.setLinvel({x:0,y:0,z:0},true);body.setAngvel({x:0,y:0,z:0},true)
  r.state.position.set(pose.x,pose.y,pose.z);r.state.yaw=pose.yaw;r.state.speed=r.state.steering=r.state.wheelRoll=0;r.state.recoveryRevision++;r.state.restorationRevision++
 }
 const accepted=parking.filter(p=>!fallback.has(p.vehicleId)&&saved.some(s=>s.vehicleId===p.vehicleId&&Math.hypot(s.x-p.pose.x,s.z-p.pose.z)<.03))
 queueRestoredParking(accepted)
 return {poses,fallback:[...fallback]}
}
