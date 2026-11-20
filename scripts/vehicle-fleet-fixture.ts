import RAPIER from '@dimforge/rapier3d-compat'
import { VEHICLES,type VehicleDefinition,type VehicleId } from '../src/game/vehicles/vehicleConfig'
import { createVehicleSim,stepVehicle,bodyYaw } from '../src/game/vehicles/vehicleSim'
import { getVehicleRuntime,useVehicleStore } from '../src/game/vehicles/vehicleState'
import { inputState,resetInput } from '../src/game/input/inputState'
import { FIXED_DT } from '../src/game/character/config'
import { CITY } from '../src/game/city/cityLayout'
import { DRIVEWAYS } from '../src/game/city/driveways'
import { buildSidewalkGeometry } from '../src/game/city/sidewalkGeometry'
import { surfaceHeightAt } from '../src/game/city/citySurface'
import { ENVIRONMENT } from '../src/game/environment/envLayout'

/** Test-only world; production controller, dimensions and all original static collisions. */
export function fleetFixture(city=false) {
  resetInput();useVehicleStore.getState().setDriving(false)
  const world=new RAPIER.World({x:0,y:-9.81,z:0}),physics={world,rapier:RAPIER}
  const box=(r:{minX:number;maxX:number;minZ:number;maxZ:number},top:number,bottom=0)=>world.createCollider(RAPIER.ColliderDesc.cuboid((r.maxX-r.minX)/2,(top-bottom)/2,(r.maxZ-r.minZ)/2).setTranslation((r.minX+r.maxX)/2,(top+bottom)/2,(r.minZ+r.maxZ)/2))
  if(city){
    box(CITY.floor,.03)
    for(const s of CITY.sidewalks){
      if(DRIVEWAYS.some(d=>d.sidewalkId===s.id)){
        const g=buildSidewalkGeometry(s,CITY.blocks.find(b=>b.id===s.blockId)!.rect)
        world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(g.getAttribute('position').array),new Uint32Array(g.getIndex()!.array)));g.dispose()
      }else box(s.rect,s.top)
    }
    for(const c of ENVIRONMENT.colliders)box(c.rect,c.y1,c.y0)
  }else box({minX:-500,maxX:500,minZ:-500,maxZ:500},.03,-1)
  const entries=new Map(VEHICLES.map(definition=>{
    const p=definition.spawn,yaw=definition.spawnYaw
    const body=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(p.x,p.y,p.z).setRotation({x:0,y:Math.sin(yaw/2),z:0,w:Math.cos(yaw/2)}).enabledRotations(false,true,false).setCcdEnabled(true).setCanSleep(true).setAngularDamping(2))
    for(const c of definition.colliders)world.createCollider(RAPIER.ColliderDesc.cuboid(...c.half).setTranslation(...c.position).setMass(c.mass).setFriction(.05).setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min),body)
    for(const x of[-definition.probeTrack,definition.probeTrack])for(const z of[-definition.wheelbase/2,definition.wheelbase/2])world.createCollider(RAPIER.ColliderDesc.ball(definition.runnerRadius).setTranslation(x,definition.runnerRadius-definition.rideHeight,z).setMass(definition.wheelMass).setFriction(.05).setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min),body)
    getVehicleRuntime(definition.id).body=body
    const entry={definition,body,sim:createVehicleSim(RAPIER)}
    return [definition.id,entry] as const
  }))
  const entry=(id:VehicleId)=>entries.get(id)!
  const step=(n:number,active:VehicleId|null=null)=>{for(let i=0;i<n;i++){for(const e of entries.values())stepVehicle(e.sim,physics,e.body,inputState,e.definition.id===active,FIXED_DT,e.definition);world.step()}}
  const place=(d:VehicleDefinition,x:number,z:number,yaw=0)=>{
    resetInput();const e=entry(d.id);e.body.setTranslation({x,y:surfaceHeightAt(x,z)+d.rideHeight+.02,z},true)
    e.body.setRotation({x:0,y:Math.sin(yaw/2),z:0,w:Math.cos(yaw/2)},true);e.body.setLinvel({x:0,y:0,z:0},true);e.body.setAngvel({x:0,y:0,z:0},true);e.sim=createVehicleSim(RAPIER);world.step();step(90)
  }
  const speed=(id:VehicleId)=>{const b=entry(id).body,v=b.linvel(),yaw=bodyYaw(b);return -Math.sin(yaw)*v.x-Math.cos(yaw)*v.z}
  const free=()=>{for(const e of entries.values())if(getVehicleRuntime(e.definition.id).body===e.body)getVehicleRuntime(e.definition.id).body=null;useVehicleStore.getState().setDriving(false);world.free()}
  return {world,physics,entries,entry,step,place,speed,free}
}
