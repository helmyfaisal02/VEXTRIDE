import type { MissionProgress } from '../missions/missionState'
import type { EconomySnapshot } from '../economy/economyState'
import type { VehicleId } from '../vehicles/vehicleConfig'
export const PROGRESS_KEY='vextride.guest.progress.v1'
export const PROGRESS_VERSION=1
export interface SavedVehiclePose{vehicleId:VehicleId;x:number;y:number;z:number;yaw:number;layoutVersion:1}
export interface SavedParking{vehicleId:VehicleId;bayId:string;source:'drive-in';pose:{x:number;y:number;z:number;yaw:number}}
export interface GuestSave{
 version:1;savedAt:number;mission:Omit<MissionProgress,'lastDialogueSession'>;economy:EconomySnapshot
 claimedRewardIds:readonly string[];processedOperationIds:readonly string[];vehicles:SavedVehiclePose[];parking:SavedParking[]
}
