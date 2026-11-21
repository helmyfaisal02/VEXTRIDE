import type { useRapier,RapierRigidBody } from '@react-three/rapier'
import type { VehicleDefinition,VehicleId } from '../vehicles/vehicleConfig'
import { vehicleRegistry,useVehicleStore } from '../vehicles/vehicleState'
import { bodyYaw } from '../vehicles/vehicleSim'
import { GARAGE,type GarageParkingBay } from './garageConfig'
import { canUseGarage } from './garageInteraction'
import { useGarageStore } from './garageState'
type Physics=Pick<ReturnType<typeof useRapier>,'world'|'rapier'>
type Boxes=InstanceType<Physics['rapier']['Cuboid']>[]
interface ParkingProof{body:RapierRigidBody;revision:number;bay:GarageParkingBay;physics:Physics;boxes:Boxes}
const confirmedParking=new Map<VehicleId,ParkingProof>()
function stationary(body:RapierRigidBody){const v=body.linvel(),a=body.angvel();return Math.hypot(v.x,v.z)<.15&&Math.abs(v.y)<.15&&Math.hypot(a.x,a.y,a.z)<.15}
function supportedClear(physics:Physics,body:RapierRigidBody,d:VehicleDefinition,bay:GarageParkingBay,boxes:Boxes){
 const p=body.translation(),q=body.rotation(),yaw=bodyYaw(body),flags=physics.rapier.QueryFilterFlags.EXCLUDE_SENSORS
 const hit=physics.world.castRayAndGetNormal(new physics.rapier.Ray({x:p.x,y:bay.y+.3,z:p.z},{x:0,y:-1,z:0}),.5,true,flags,undefined,undefined,body)
 if(!hit||hit.normal.y<=.9||Math.abs(.3-hit.timeOfImpact)>=.08)return false
 const cs=Math.cos(yaw),sn=Math.sin(yaw)
 for(const [index,c] of d.colliders.entries()){
  const [x,y,z]=c.position
  if(physics.world.intersectionWithShape({x:p.x+cs*x+sn*z,y:p.y+y,z:p.z-sn*x+cs*z},q,boxes[index],flags,undefined,undefined,body))return false
 }
 return true
}
/** Services revalidate the detector's earned proof against the current body, not a stale UI flag. */
export function isConfirmedParked(id:VehicleId){
 const proof=confirmedParking.get(id),r=vehicleRegistry.get(id),body=r?.body,ownership=useVehicleStore.getState()
 if(!proof||!r||body!==proof.body||!body.isValid()||!body.isEnabled()||r.state.recoveryRevision!==proof.revision||useGarageStore.getState().occupancy[proof.bay.id]!==id||(ownership.driving&&ownership.activeVehicleId===id))return false
 const p=body.translation(),q=body.rotation()
 return stationary(body)&&fitsParkingBay(r.definition,{...p,yaw:bodyYaw(body),up:1-2*(q.x*q.x+q.z*q.z)},proof.bay)&&supportedClear(proof.physics,body,r.definition,proof.bay,proof.boxes)
}
export function canServiceParkedVehicle(id:VehicleId,player:RapierRigidBody){
 const proof=confirmedParking.get(id)
 return !!proof&&isConfirmedParked(id)&&canUseGarage(proof.physics,player)
}
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
  clear(){confirmedParking.clear();histories.clear();shapes.clear();elapsed=0;useGarageStore.getState().publish({})},
  step(physics:Physics,dt:number){
   if(!Number.isFinite(dt)||dt<=0)return
   elapsed+=dt;if(elapsed<.1-1e-6)return
   const delta=elapsed;elapsed=0
   const ownership=useVehicleStore.getState(),occupancy:Record<string,VehicleId>={},proofs=new Map<VehicleId,ParkingProof>()
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
     let safe=stationary(body)&&h.arrived===bay.id&&!occupied&&credible
     let boxes=shapes.get(id)
     if(safe){
      if(!boxes){boxes=r.definition.colliders.map(c=>new physics.rapier.Cuboid(c.half[0]+.015,c.half[1]+.015,c.half[2]+.015));shapes.set(id,boxes)}
      safe=supportedClear(physics,body,r.definition,bay,boxes)
     }
     h.settled=safe?h.settled+delta:0
     if(h.settled>=1&&!occupancy[bay.id]&&boxes){occupancy[bay.id]=id;proofs.set(id,{body,revision:r.state.recoveryRevision,bay,physics,boxes})}
    }
    h.x=p.x;h.z=p.z;h.speed=speed;h.bay=bay?.id??null
   }
   confirmedParking.clear();for(const [id,proof] of proofs)confirmedParking.set(id,proof)
   useGarageStore.getState().publish(occupancy)
  },
 }
}
