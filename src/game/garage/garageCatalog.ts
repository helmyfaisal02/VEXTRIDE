import { VEHICLES } from '../vehicles/vehicleConfig'
import { vehicleRegistry } from '../vehicles/vehicleState'
import type { ParkingOccupancy } from './garageState'
const descriptions={coupe:'Quick acceleration, agile steering and sporty cornering.',sedan:'Balanced acceleration, steady grip and predictable braking.',pickup:'Heavier steering, a wider turning radius and stable low-speed handling.'}
export function garageCatalog(occupancy:ParkingOccupancy){
 return VEHICLES.map(d=>({id:d.id,name:d.name,type:d.modelType==='coupe'?'Street coupe':d.modelType==='sedan'?'Four-door sedan':'Utility pickup',dimensions:`${d.length.toFixed(2)} × ${d.width.toFixed(2)} × ${d.height.toFixed(2)} m`,topSpeed:Math.round(d.maxSpeed*3.6),description:descriptions[d.modelType],bayId:Object.keys(occupancy).find(id=>occupancy[id]===d.id)??null,present:!!vehicleRegistry.get(d.id)?.body?.isValid()}))
}
