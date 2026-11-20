import { motorParking } from '../city/driveways'
import { ROAD_TOP } from '../city/cityConfig'
import { BUILDINGS } from '../environment/buildingPlacements'
import { Frame } from '../environment/localFrame'

export type VehicleId = 'street-coupe' | 'city-sedan' | 'utility-pickup'
export interface ChassisCollider { half: [number,number,number]; position: [number,number,number]; mass: number }
export interface VehicleDefinition {
  id: VehicleId; name: string; modelType: 'coupe' | 'sedan' | 'pickup'
  length: number; width: number; height: number; mass: number
  wheelRadius: number; wheelWidth: number; wheelbase: number
  rideHeight: number; runnerRadius: number; probeTrack: number; wheelMass: number
  colliders: readonly ChassisCollider[]
  maxSpeed: number; reverseSpeed: number; acceleration: number; reverseAcceleration: number
  brake: number; coast: number; steeringAngle: number; steeringResponse: number
  traction: number; handbrakeTraction: number; handbrakeBrake: number
  yawLimit: number; highSpeedSteering: number; maxGroundRise: number
  entryRange: number; exitSpeed: number
  camera: { distance: number; focusHeight: number; pitch: number }
  spawn: { x: number; y: number; z: number }; spawnYaw: number
}
const pads = motorParking()
export const CHASSIS_COLLIDERS: readonly ChassisCollider[] = [
  { half: [.84,.27,2.08], position: [0,-.03,0], mass: 1000 },
  { half: [.65,.30,.75], position: [0,.57,.1], mass: 30 },
]

/** Phase 3.1 coupe tuning, model, collider dimensions and stall are retained. */
export const COUPE: VehicleDefinition = {
  id: 'street-coupe', modelType: 'coupe', name: 'VEXTRIDE Street Coupe',
  length: 4.2, width: 1.8, height: 1.4, mass: 1130,
  wheelRadius: .32, wheelWidth: .22, wheelbase: 2.64,
  rideHeight: .5, runnerRadius: .28, probeTrack: .64, wheelMass: 25, colliders: CHASSIS_COLLIDERS,
  maxSpeed: 22, reverseSpeed: 7, acceleration: 8, reverseAcceleration: 5, brake: 16, coast: 2,
  steeringAngle: .55, steeringResponse: 9, traction: 16, handbrakeTraction: 5, handbrakeBrake: 12,
  yawLimit: 1.35, highSpeedSteering: .04, maxGroundRise: 1.2,
  entryRange: 3, exitSpeed: 1, camera: { distance: 8, focusHeight: .55, pitch: .3 },
  spawn: { x: pads.north.minX + 1 + 2.8 * 5.5, y: ROAD_TOP + .52, z: pads.north.minZ + 3.5 }, spawnYaw: Math.PI,
}
export const SEDAN: VehicleDefinition = {
  ...COUPE, id: 'city-sedan', modelType: 'sedan', name: 'VEXTRIDE City Sedan',
  length: 4.6, width: 1.85, height: 1.5, mass: 1450,
  wheelRadius: .34, wheelWidth: .24, wheelbase: 2.8, rideHeight: .55, runnerRadius: .30, probeTrack: .66, wheelMass: 30,
  colliders: [{half:[.88,.30,2.28],position:[0,-.02,0],mass:1250},{half:[.68,.32,.95],position:[0,.62,.10],mass:80}],
  maxSpeed: 18, reverseSpeed: 6, acceleration: 6, reverseAcceleration: 4, brake: 14, coast: 2,
  steeringAngle: .48, steeringResponse: 6.5, traction: 20, handbrakeTraction: 7, handbrakeBrake: 11,
  yawLimit: 1.15, highSpeedSteering: .05, maxGroundRise: 1.1,
  camera: {distance:8.6,focusHeight:.62,pitch:.31},
  spawn: {x:pads.south.minX+1+2.8*7.5,y:ROAD_TOP+.57,z:pads.south.maxZ-3.5}, spawnYaw: 0,
}
const warehouse = BUILDINGS.find(b => b.id === 'building-17')!
/** Same existing reserved apron bounds used by placeIndustrial; no new paving/entrance. */
export const PICKUP_APRON = new Frame(warehouse.x,warehouse.z,warehouse.facing).rect(warehouse.width/2+3.3,warehouse.width/2+9,-warehouse.depth/2+4,warehouse.depth/2-4)
export const PICKUP: VehicleDefinition = {
  ...COUPE, id:'utility-pickup', modelType:'pickup', name:'VEXTRIDE Utility Pickup',
  length:5.1,width:2,height:1.8,mass:1950,
  wheelRadius:.39,wheelWidth:.30,wheelbase:3.16,rideHeight:.65,runnerRadius:.34,probeTrack:.66,wheelMass:40,
  colliders:[
    {half:[.94,.16,2.52],position:[0,-.19,0],mass:1300},
    {half:[.91,.26,.69],position:[0,.09,-1.83],mass:200},
    {half:[.76,.43,.85],position:[0,.68,-.40],mass:170},
    {half:[.09,.29,.99],position:[-.91,.22,1.46],mass:40},
    {half:[.09,.29,.99],position:[.91,.22,1.46],mass:40},
    {half:[.90,.30,.06],position:[0,.20,2.49],mass:40},
  ],
  maxSpeed:15,reverseSpeed:5,acceleration:4.5,reverseAcceleration:3.2,brake:12,coast:1.8,
  steeringAngle:.43,steeringResponse:4.5,traction:22,handbrakeTraction:9,handbrakeBrake:10,
  yawLimit:.9,highSpeedSteering:.055,maxGroundRise:1,
  camera:{distance:9.5,focusHeight:.75,pitch:.34},
  spawn:{x:(PICKUP_APRON.minX+PICKUP_APRON.maxX)/2,y:ROAD_TOP+.67,z:(PICKUP_APRON.minZ+PICKUP_APRON.maxZ)/2},spawnYaw:Math.PI/2,
}
export const VEHICLES: readonly VehicleDefinition[] = [COUPE,SEDAN,PICKUP]
export function vehicleWheels(definition: VehicleDefinition) {
  const x=definition.width/2-definition.wheelWidth/2,z=definition.wheelbase/2
  return [{x:-x,z:-z,front:true},{x,z:-z,front:true},{x:-x,z,front:false},{x,z,front:false}]
}
export const WHEELS = vehicleWheels(COUPE)
export const getVehicleDefinition = (id: VehicleId) => VEHICLES.find(d=>d.id===id)!
