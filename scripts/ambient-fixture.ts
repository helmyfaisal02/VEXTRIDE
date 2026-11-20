import { fleetFixture } from './vehicle-fleet-fixture'
import { TRAFFIC,PEDESTRIANS } from '../src/game/ambient/ambientConfig'
import { createTrafficSim,createPedestrianSim,stepTraffic,stepPedestrian } from '../src/game/ambient/ambientSim'
import { surfaceHeightAt } from '../src/game/city/citySurface'
import { NPCS,npcHeight } from '../src/game/npcs/npcConfig'
/** Production controllers, actual city collision fixture, all parked cars and named NPC capsules. */
export function ambientFixture(){
 const fleet=fleetFixture(true),{world,physics}=fleet,r=physics.rapier
 for(const d of NPCS){const h=npcHeight(d),b=world.createRigidBody(r.RigidBodyDesc.fixed().setTranslation(d.spawn.x,d.spawn.y,d.spawn.z));world.createCollider(r.ColliderDesc.capsule(h/2-d.radius,d.radius).setTranslation(0,h/2,0),b)}
 const traffic=TRAFFIC.map(d=>{
  const sim=createTrafficSim(physics,d),p=sim.pose,v=d.vehicle
  const body=world.createRigidBody(r.RigidBodyDesc.kinematicPositionBased().setTranslation(p.x,.03+v.rideHeight,p.z).setRotation({x:0,y:Math.sin(p.yaw/2),z:0,w:Math.cos(p.yaw/2)}))
  world.createCollider(r.ColliderDesc.cuboid(v.width/2,v.height/2,v.length/2).setTranslation(0,v.height/2-v.rideHeight,0).setFriction(0).setRestitution(0),body)
  return {definition:d,sim,body}
 })
 const pedestrians=PEDESTRIANS.map(d=>{
  const sim=createPedestrianSim(physics,d),p=d.points[0],body=world.createRigidBody(r.RigidBodyDesc.kinematicPositionBased().setTranslation(p.x,surfaceHeightAt(p.x,p.z)+.93,p.z).setRotation({x:0,y:Math.sin(sim.yaw/2),z:0,w:Math.cos(sim.yaw/2)}))
  world.createCollider(r.ColliderDesc.capsule(.6,.3).setFriction(0).setRestitution(0),body)
  return {definition:d,sim,body}
 })
 fleet.step(90)
 const step=(n:number)=>{for(let i=0;i<n;i++){for(const a of traffic)stepTraffic(physics,a.body,a.sim,a.definition,1/60);for(const a of pedestrians)stepPedestrian(physics,a.body,a.sim,a.definition,1/60);fleet.step(1)}}
 return {...fleet,traffic,pedestrians,step}
}
