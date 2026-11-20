import { COUPE,SEDAN,type VehicleDefinition } from '../vehicles/vehicleConfig'
import { resolveAppearance,type Appearance } from '../character/presets'
import { TRAFFIC_ROUTES,type TrafficRoute } from './ambientRoutes'
export interface TrafficDefinition {id:string;vehicle:VehicleDefinition;route:TrafficRoute;start:number;speed:number;paint:string}
export const TRAFFIC:readonly TrafficDefinition[]=[
 {id:'ambient-coupe',vehicle:COUPE,route:TRAFFIC_ROUTES[0],start:16,speed:8,paint:'#df7c48'},
 {id:'ambient-sedan',vehicle:SEDAN,route:TRAFFIC_ROUTES[1],start:22,speed:7,paint:'#e5d6ac'},
]
export interface PedestrianDefinition {id:string;points:readonly {x:number;z:number}[];speed:number;appearance:Appearance}
export const PEDESTRIANS:readonly PedestrianDefinition[]=[
 {id:'ambient-plaza',points:[{x:-58,z:-22},{x:-58,z:-14}],speed:1.15,appearance:resolveAppearance({name:'',preset:'urban-blue',topColor:2})},
 {id:'ambient-downtown',points:[{x:-45,z:-86.5},{x:-35,z:-86.5}],speed:1.25,appearance:resolveAppearance({name:'',preset:'street-red',topColor:3})},
 {id:'ambient-residential',points:[{x:-151,z:-68},{x:-151,z:-58}],speed:1.1,appearance:resolveAppearance({name:'',preset:'metro-green',topColor:2})},
]
