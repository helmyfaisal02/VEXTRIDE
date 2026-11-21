import type { VehicleId } from '../vehicles/vehicleConfig'
import type { PaintId } from '../vehicles/vehiclePaint'
import type { MissionId } from '../missions/missionDefinitions'
interface TransactionBase{id:string;amount:number;reason:string;sequence:number;balanceAfter:number}
export type EconomyTransaction=TransactionBase&({type:'EARN';missionId:MissionId}|{type:'SPEND';vehicleId:VehicleId;paintId:PaintId})
export interface EconomySnapshot{balance:number;sequence:number;transactions:readonly EconomyTransaction[];paints:Readonly<Record<VehicleId,PaintId>>}
export const initialEconomyState=():EconomySnapshot=>({balance:0,sequence:0,transactions:[],paints:{'street-coupe':'factory','city-sedan':'factory','utility-pickup':'factory'}})
