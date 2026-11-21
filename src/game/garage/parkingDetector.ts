import type { useRapier } from '@react-three/rapier'
import type { VehicleDefinition,VehicleId } from '../vehicles/vehicleConfig'
import { vehicleRegistry,useVehicleStore } from '../vehicles/vehicleState'
import { bodyYaw } from '../vehicles/vehicleSim'
import { GARAGE,type GarageParkingBay } from './garageConfig'
import { useGarageStore } from './garageState'
type Physics=Pick<ReturnType<typeof useRapier>,'world'|'rapier'>
interface Pose{x:number;y:number;z:number;yaw:number;up:number}
/** All four oriented chassis-footprint corners must fit, with a small clearance skin. */
export function fitsParkingBay(d:VehicleDefinition,p:Pose,b:GarageParkingBay){
 if(!Object.values(p).every(Number.isFinite)||p.up<.95||Math.abs(p.y-d.rideHeight-b.y)>.15||Math.abs(Math.cos(p.yaw-b.yaw))<Math.cos(Math.PI/9))return false
 const c=Math.cos(p.yaw),s=Math.sin(p.yaw)
 for(const x of[-d.width/2,d.width/2])for(const z of[-d.length/2,d.length/2]){
  const wx=p.x+c*x+s*z-b.x,wz=p.z-s*x+c*z-b.z
  if(Math.abs(wx)>b.width/2-.04||Math.abs(wz)>b.length/2-.04)return false
 }
 return true
}
interface History{body:number;x:number;z:number;revision:number;bay:string|null;arrived:string|null;outside:boolean;settled:number;speed:number}
/** 10 Hz observer. A recovery/remount inside a bay requires leaving and legitimately driving back in. */
export function createParkingDetector(){
 let elapsed=0
 const histories=new Map<VehicleId,History>()
 const shapes=new Map<VehicleId,InstanceType<Physics['rapier']['Cuboid']>[]>()
 return {
  clear(){histories.clear();shapes.clear();elapsed=0;useGarageStore.getState().publish({})},
  step(physics:Physics,dt:number){
   if(!Number.isFinite(dt)||dt<=0)return
   elapsed+=dt;if(elapsed<.1-1e-6)return
   const delta=elapsed;elapsed=0
   const ownership=useVehicleStore.getState(),occupancy:Record<string,VehicleId>={}
   for(const [id,r] of vehicleRegistry){
    const body=r.body;if(!body?.isValid()||!body.isEnabled()){histories.delete(id);continue}
    const p=body.translation(),v=body.linvel(),q=body.rotation(),yaw=bodyYaw(body),speed=Math.hypot(v.x,v.z),up=1-2*(q.x*q.x+q.z*q.z)
    const bay=GARAGE.bays.find(b=>fitsParkingBay(r.definition,{...p,yaw,up},b))
    let h=histories.get(id)
    if(!h||h.body!==body.handle||h.revision!==r.state.recoveryRevision){
     h={body:body.handle,x:p.x,z:p.z,revision:r.state.recoveryRevision,bay:bay?.id??null,arrived:null,outside:!bay,settled:0,speed};histories.set(id,h)
    }
    const moved=Math.hypot(p.x-h.x,p.z-h.z),credible=delta<=.15&&moved<=Math.max(speed,h.speed)*delta+.06
    if(!credible){h.arrived=null;h.outside=!bay}
    if(!bay){h.arrived=null;h.outside=true;h.settled=0}
    else{
     const occupied=ownership.driving&&ownership.activeVehicleId===id
     if(occupied&&h.outside&&h.bay!==bay.id&&credible&&moved>.005&&speed>.15)h.arrived=bay.id
     const angular=body.angvel()
     const stationary=speed<.15&&Math.abs(v.y)<.15&&Math.hypot(angular.x,angular.y,angular.z)<.15
     let safe=stationary&&h.arrived===bay.id&&!occupied&&credible
     if(safe){
      // Ground support and actual chassis clearance; self/sensors are excluded.
      const flags=physics.rapier.QueryFilterFlags.EXCLUDE_SENSORS
      const hit=physics.world.castRayAndGetNormal(new physics.rapier.Ray({x:p.x,y:bay.y+.3,z:p.z},{x:0,y:-1,z:0}),.5,true,flags,undefined,undefined,body)
      safe=!!hit&&hit.normal.y>.9&&Math.abs(bay.y+.3-hit.timeOfImpact-bay.y)<.08
      let boxes=shapes.get(id)
      if(!boxes){boxes=r.definition.colliders.map(c=>new physics.rapier.Cuboid(c.half[0]+.015,c.half[1]+.015,c.half[2]+.015));shapes.set(id,boxes)}
      if(safe)for(const [index,c] of r.definition.colliders.entries()){
       const cs=Math.cos(yaw),sn=Math.sin(yaw),[x,y,z]=c.position
       if(physics.world.intersectionWithShape({x:p.x+cs*x+sn*z,y:p.y+y,z:p.z-sn*x+cs*z},q,boxes[index],flags,undefined,undefined,body)){safe=false;break}
      }
     }
     h.settled=safe?h.settled+delta:0
     if(h.settled>=1&&!occupancy[bay.id])occupancy[bay.id]=id
    }
    h.x=p.x;h.z=p.z;h.speed=speed;h.bay=bay?.id??null
   }
   useGarageStore.getState().publish(occupancy)
  },
 }
}
