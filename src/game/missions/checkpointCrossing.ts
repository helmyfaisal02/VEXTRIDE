import type { VehicleId } from '../vehicles/vehicleConfig'
import { CHECKPOINTS,type CheckpointId } from './checkpointRoute'
export interface VehicleSample {
 vehicleId:VehicleId;x:number;y:number;z:number;vx:number;vz:number;yaw:number;up:number;revision:number
}
/** Swept centre crossing, in the correct lane/direction, at a credible fixed-step displacement.
 * Sampling ownership/validity and recovery revisions is handled by MissionDriver.
 */
export function crossesCheckpoint(id:CheckpointId,previous:VehicleSample,current:VehicleSample,dt:number){
 const gate=CHECKPOINTS.find(g=>g.id===id)
 if(!gate||previous.vehicleId!==current.vehicleId||previous.revision!==current.revision||!Number.isFinite(dt)||dt<=0||dt>.05)return false
 if(![previous,current].every(p=>[p.x,p.y,p.z,p.vx,p.vz,p.yaw,p.up,p.revision].every(Number.isFinite)))return false
 const d=gate.direction,p=gate.spawn,dx=current.x-previous.x,dz=current.z-previous.z
 const speed=Math.hypot(current.vx,current.vz),travel=Math.hypot(dx,dz)
 if(speed<1||speed>25||travel<.001||travel>Math.max(speed,Math.hypot(previous.vx,previous.vz))*dt+.06||Math.abs(current.y-previous.y)>.15)return false
 if(current.up<.85||current.y<p.y+.25||current.y>p.y+1.2)return false
 if(current.vx*d.x+current.vz*d.z<1||-Math.sin(current.yaw)*d.x-Math.cos(current.yaw)*d.z<.75)return false
 const before=(previous.x-p.x)*d.x+(previous.z-p.z)*d.z,after=(current.x-p.x)*d.x+(current.z-p.z)*d.z
 if(before>=0||after<0)return false
 const t=-before/(after-before),x=previous.x+t*dx-p.x,z=previous.z+t*dz-p.z
 return Math.abs(x*-d.z+z*d.x)<=gate.halfWidth
}
