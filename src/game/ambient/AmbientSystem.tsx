import { memo,useEffect,useState } from 'react'
import { createSharedVehicleMaterials } from '../vehicles/modelPrimitives'
import { TRAFFIC,PEDESTRIANS } from './ambientConfig'
import { TrafficCar } from './TrafficCar'
import { AmbientPedestrian } from './AmbientPedestrian'
function AmbientSystemImpl(){
 const [shared]=useState(createSharedVehicleMaterials)
 useEffect(()=>()=>{Object.values(shared).forEach(m=>m.dispose())},[shared])
 return <>{TRAFFIC.map(d=><TrafficCar key={d.id} definition={d} shared={shared}/>)}{PEDESTRIANS.map(d=><AmbientPedestrian key={d.id} definition={d}/>)}</>
}
export const AmbientSystem=memo(AmbientSystemImpl)
