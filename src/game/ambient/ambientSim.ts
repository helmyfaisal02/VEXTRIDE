import type { useRapier,RapierRigidBody } from '@react-three/rapier'
import { surfaceHeightAt } from '../city/citySurface'
import { ROAD_TOP } from '../city/cityConfig'
import type { TrafficDefinition,PedestrianDefinition } from './ambientConfig'
import { angleDelta,createRoutePose,sampleRoute } from './ambientRoutes'
type Physics=Pick<ReturnType<typeof useRapier>,'world'|'rapier'>
const IDENTITY={x:0,y:0,z:0,w:1}
const approach=(v:number,target:number,delta:number)=>v+Math.sign(target-v)*Math.min(Math.abs(target-v),delta)
export function createTrafficSim(physics:Physics,d:TrafficDefinition){
 const pose=sampleRoute(d.route,d.start,createRoutePose())
 return {distance:d.start,speed:0,desired:0,blocked:false,laneId:pose.laneId,movementId:pose.movementId,roll:0,steer:0,braking:false,timer:0,hazard:Infinity,limit:8,pose,next:createRoutePose(),scan:createRoutePose(),center:{x:0,y:0,z:0},rotation:{...IDENTITY},velocity:{x:0,y:0,z:0},shape:new physics.rapier.Cuboid(d.vehicle.width/2+.4,d.vehicle.height/2,d.vehicle.length/2+.4),ray:new physics.rapier.Ray({x:0,y:0,z:0},{x:0,y:-1,z:0}),previous:null as {x:number;z:number}|null}
}
export type TrafficSim=ReturnType<typeof createTrafficSim>
function trafficShapeAt(s:TrafficSim,d:TrafficDefinition,x:number,z:number,yaw:number,pad=0){
 s.shape.halfExtents.x=d.vehicle.width/2+.4+pad;s.shape.halfExtents.z=d.vehicle.length/2+.4+pad
 s.center.x=x;s.center.y=ROAD_TOP+d.vehicle.height/2+.08;s.center.z=z
 s.rotation.y=Math.sin(yaw/2);s.rotation.w=Math.cos(yaw/2)
}
/** Full-volume clearance, ignoring sensors/self only. Both dynamic and kinematic actors block. */
export function trafficClear(physics:Physics,body:RapierRigidBody,s:TrafficSim,d:TrafficDefinition,x:number,z:number,yaw:number){
 trafficShapeAt(s,d,x,z,yaw)
 return !physics.world.intersectionWithShape(s.center,s.rotation,s.shape,physics.rapier.QueryFilterFlags.EXCLUDE_SENSORS,undefined,undefined,body)
}
export function stepTraffic(physics:Physics,body:RapierRigidBody,s:TrafficSim,d:TrafficDefinition,dt:number){
 const p=body.translation()
 if(s.previous){const traveled=Math.hypot(p.x-s.previous.x,p.z-s.previous.z);if(traveled<1)s.roll-=traveled/d.vehicle.wheelRadius}
 if(!s.previous)s.previous={x:p.x,z:p.z};else{s.previous.x=p.x;s.previous.z=p.z}
 sampleRoute(d.route,s.distance,s.pose)
 s.timer-=dt
 if(s.timer<=0){
  s.timer=.1;s.hazard=Infinity;s.limit=d.speed
  const reach=Math.max(8,s.speed*s.speed/7+4)
  for(let ahead=0;ahead<=reach;ahead+=.65){
   sampleRoute(d.route,s.distance+ahead,s.scan);s.limit=Math.min(s.limit,s.scan.limit)
   if(!trafficClear(physics,body,s,d,s.scan.x,s.scan.z,s.scan.yaw)){s.hazard=ahead;break}
  }
 }
 s.desired=Math.min(s.limit,Math.sqrt(7*Math.max(0,s.hazard-2)))
 const old=s.speed
 s.speed=approach(s.speed,s.desired,(s.desired<s.speed?3.5:1.6)*dt)
 const travel=s.speed*dt
 sampleRoute(d.route,s.distance+travel,s.next)
 const dx=s.next.x-p.x,dz=s.next.z-p.z,len=Math.hypot(dx,dz)
 // Enclose rotation during the sweep as well as translation, so corner overhang cannot clip.
 trafficShapeAt(s,d,p.x,p.z,s.pose.yaw,Math.abs(angleDelta(s.pose.yaw,s.next.yaw))*Math.hypot(d.vehicle.length,d.vehicle.width)/2)
 s.velocity.x=len>0?dx/len:0;s.velocity.z=len>0?dz/len:0
 const hit=len>1e-8&&physics.world.castShape(s.center,s.rotation,s.velocity,s.shape,.015,len,true,physics.rapier.QueryFilterFlags.EXCLUDE_SENSORS,undefined,undefined,body)
 s.ray.origin.x=s.next.x;s.ray.origin.y=1;s.ray.origin.z=s.next.z
 const ground=physics.world.castRayAndGetNormal(s.ray,2,true,physics.rapier.QueryFilterFlags.EXCLUDE_DYNAMIC|physics.rapier.QueryFilterFlags.EXCLUDE_KINEMATIC|physics.rapier.QueryFilterFlags.EXCLUDE_SENSORS)
 const supported=ground&&ground.normal.y>.9&&Math.abs(1-ground.timeOfImpact-ROAD_TOP)<.035
 const clear=(!hit||hit.time_of_impact>len)&&supported&&trafficClear(physics,body,s,d,s.next.x,s.next.z,s.next.yaw)
 s.blocked=!clear||s.desired<.05
 s.braking=s.speed<old-.001||s.blocked
 if(clear){
  s.distance=(s.distance+travel)%d.route.length
  body.setNextKinematicTranslation({x:s.next.x,y:ROAD_TOP+d.vehicle.rideHeight,z:s.next.z})
  body.setNextKinematicRotation({x:0,y:Math.sin(s.next.yaw/2),z:0,w:Math.cos(s.next.yaw/2)})
  const target=travel>.0001?Math.atan(d.vehicle.wheelbase*angleDelta(s.pose.yaw,s.next.yaw)/travel):0
  s.steer+=(Math.max(-.6,Math.min(.6,target))-s.steer)*(1-Math.exp(-5*dt))
 }else{s.speed=0;body.setNextKinematicTranslation(p);body.setNextKinematicRotation(body.rotation())}
 s.hazard=Math.max(0,s.hazard-(clear?travel:0));s.laneId=s.pose.laneId;s.movementId=s.pose.movementId
}
export function createPedestrianSim(physics:Physics,d:PedestrianDefinition){
 const p=d.points[0],q=d.points[1]
 return {speed:0,blocked:false,target:1,phase:0,wait:.5,yaw:Math.atan2(q.x-p.x,q.z-p.z),time:0,move:0,center:{x:0,y:0,z:0},velocity:{x:0,y:0,z:0},shape:new physics.rapier.Capsule(.55,.35),ray:new physics.rapier.Ray({x:0,y:0,z:0},{x:0,y:-1,z:0})}
}
export type PedestrianSim=ReturnType<typeof createPedestrianSim>
export function stepPedestrian(physics:Physics,body:RapierRigidBody,s:PedestrianSim,d:PedestrianDefinition,dt:number){
 s.time+=dt
 const p=body.translation(),q=d.points[s.target],dx=q.x-p.x,dz=q.z-p.z,distance=Math.hypot(dx,dz)
 if(distance<.05){s.target=(s.target+1)%d.points.length;s.wait=1.4}
 s.wait=Math.max(0,s.wait-dt)
 const desiredYaw=Math.atan2(dx,dz),delta=angleDelta(s.yaw,desiredYaw)
 s.yaw+=Math.sign(delta)*Math.min(Math.abs(delta),1.8*dt)
 const desired=s.wait>0||Math.abs(delta)>.18||distance<.05?0:Math.min(d.speed,Math.sqrt(4*Math.max(0,distance-.04)))
 // Finish braking before turning; a stopped endpoint must not retain backward travel.
 s.speed=desired===0?0:approach(s.speed,desired,2*dt)
 const travel=Math.min(distance,s.speed*dt),x=p.x+(distance>0?dx/distance*travel:0),z=p.z+(distance>0?dz/distance*travel:0)
 const groundY=surfaceHeightAt(x,z)
 s.center.x=p.x;s.center.y=p.y;s.center.z=p.z;s.velocity.x=distance>0?dx/distance:0;s.velocity.z=distance>0?dz/distance:0
 const hit=travel>1e-8&&physics.world.castShape(s.center,IDENTITY,s.velocity,s.shape,.015,travel,true,physics.rapier.QueryFilterFlags.EXCLUDE_SENSORS,undefined,undefined,body)
 s.ray.origin.x=x;s.ray.origin.y=groundY+1;s.ray.origin.z=z
 const ground=physics.world.castRayAndGetNormal(s.ray,1.5,true,physics.rapier.QueryFilterFlags.EXCLUDE_DYNAMIC|physics.rapier.QueryFilterFlags.EXCLUDE_KINEMATIC|physics.rapier.QueryFilterFlags.EXCLUDE_SENSORS)
 s.center.x=x;s.center.y=groundY+.93;s.center.z=z
 const clear=(!hit||hit.time_of_impact>travel)&&ground&&ground.normal.y>.9&&Math.abs(groundY+1-ground.timeOfImpact-groundY)<.03&&!physics.world.intersectionWithShape(s.center,IDENTITY,s.shape,physics.rapier.QueryFilterFlags.EXCLUDE_SENSORS,undefined,undefined,body)
 s.blocked=!clear
 if(clear){body.setNextKinematicTranslation(s.center);s.phase=(s.phase+travel*Math.PI*2/1.3)%(Math.PI*2)}
 else{s.speed=0;body.setNextKinematicTranslation(p)}
 body.setNextKinematicRotation({x:0,y:Math.sin(s.yaw/2),z:0,w:Math.cos(s.yaw/2)})
 s.move+=(Number(s.speed>.05)-s.move)*(1-Math.exp(-8*dt))
}
