import { initialEconomyState } from '../economy/economyState'
import { transact } from '../economy/economyTransactions'
import { MISSION_REWARDS,STREET_CASH } from '../economy/economyConfig'
import { MISSIONS } from '../missions/missionDefinitions'
import type { MissionProgress } from '../missions/missionState'
import { VEHICLES } from '../vehicles/vehicleConfig'
import { paintPreset } from '../vehicles/vehiclePaint'
import { GARAGE } from '../garage/garageConfig'
import { fitsParkingBay } from '../garage/parkingDetector'
import { surfaceHeightAt } from '../city/citySurface'
import { CITY } from '../city/cityLayout'
import type { GuestSave,SavedParking,SavedVehiclePose } from './persistenceSchema'
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b)
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)
export function plausiblePose(v:unknown):v is SavedVehiclePose{
 if(!object(v)||v.layoutVersion!==1||!VEHICLES.some(d=>d.id===v.vehicleId)||![v.x,v.y,v.z,v.yaw].every(finite))return false
 const {x,y,z,yaw}=v as unknown as SavedVehiclePose,d=VEHICLES.find(d=>d.id===v.vehicleId)!
 return x>CITY.floor.minX+3&&x<CITY.floor.maxX-3&&z>CITY.floor.minZ+3&&z<CITY.floor.maxZ-3&&Math.abs(yaw)<=Math.PI*2+.001&&Math.abs(y-d.rideHeight-surfaceHeightAt(x,z))<.2
}
export type ValidationResult={ok:true;save:GuestSave;warning:string}|{ok:false;message:string;unsupported:boolean}
/** Strict coherent core; bad world records are dropped independently. No hydration rewards. */
export function validateGuestSave(raw:string):ValidationResult{
 const bad=(message:string,unsupported=false):ValidationResult=>({ok:false,message,unsupported})
 if(raw.length>65536)return bad('Guest save is too large.')
 let value:unknown
 try{value=JSON.parse(raw)}catch{return bad('Guest save contains invalid JSON.')}
 if(!object(value))return bad('Guest save is not an object.')
 if(value.version!==1)return bad('Unsupported guest save version.',typeof value.version==='number'&&value.version>1)
 if(!Number.isSafeInteger(value.savedAt)||Number(value.savedAt)<0||!object(value.mission)||!object(value.economy))return bad('Guest save core is incomplete.')
 const e=value.economy,m=value.mission
 if(!Array.isArray(e.transactions)||e.transactions.length>64||!object(e.paints))return bad('Invalid economy records.')
 let economy=initialEconomyState()
 for(const [i,entry] of e.transactions.entries()){
  if(!object(entry)||typeof entry.id!=='string'||typeof entry.reason!=='string'||entry.reason.length>120||entry.sequence!==i+1)return bad('Invalid ledger entry.')
  let result:ReturnType<typeof transact>
  if(entry.type==='EARN'){
   const definition=MISSIONS.find(d=>d.id===entry.missionId)
   if(!definition)return bad('Unknown mission reward.')
   const reward=MISSION_REWARDS[definition.id]
   if(entry.id!==`mission:${definition.id}`||entry.amount!==reward.amount||entry.reason!==reward.reason)return bad('Invalid mission reward.')
   if(definition.requires&&!economy.transactions.some(t=>t.type==='EARN'&&t.missionId===definition.requires))return bad('Reward dependency is inconsistent.')
   result=transact(economy,{id:entry.id,type:'EARN',amount:reward.amount,reason:reward.reason,missionId:definition.id})
  }else if(entry.type==='SPEND'){
   const d=VEHICLES.find(d=>d.id===entry.vehicleId),preset=d&&typeof entry.paintId==='string'?paintPreset(d.id,entry.paintId):undefined
   const operation=Number(entry.id.slice(8))
   if(!d||!preset||!/^respray:[1-9]\d*$/.test(entry.id)||!Number.isSafeInteger(operation)||entry.amount!==STREET_CASH.resprayPrice||entry.reason!==`Body respray — ${preset.name}`||economy.paints[d.id]===preset.id)return bad('Invalid respray history.')
   result=transact(economy,{id:entry.id,type:'SPEND',amount:STREET_CASH.resprayPrice,reason:entry.reason,vehicleId:d.id,paintId:preset.id})
   if(result.ok)result={ok:true,economy:{...result.economy,paints:{...result.economy.paints,[d.id]:preset.id}}}
  }else return bad('Unknown ledger type.')
  if(!result.ok||entry.balanceAfter!==result.economy.balance)return bad('Ledger balance is inconsistent.')
  economy=result.economy
 }
 if(e.balance!==economy.balance||e.sequence!==economy.sequence||!VEHICLES.every(d=>Object.prototype.hasOwnProperty.call(e.paints,d.id)?(e.paints as Record<string,unknown>)[d.id]===economy.paints[d.id]:economy.paints[d.id]==='factory'))return bad('Balance or paint does not match the ledger.')
 const claimed=economy.transactions.filter(t=>t.type==='EARN').map(t=>t.id),processed=economy.transactions.map(t=>t.id)
 if(!same(value.claimedRewardIds,claimed)||!same(value.processedOperationIds,processed))return bad('Claimed or processed operations do not match the ledger.')
 const completed=economy.transactions.flatMap(t=>t.type==='EARN'?[t.missionId]:[])
 if(!same(m.completed,completed))return bad('Mission completion history does not match rewards.')
 const definition=MISSIONS.find(d=>d.id===m.missionId)
 if(!definition||!['NOT_STARTED','ACTIVE','COMPLETED'].includes(String(m.status)))return bad('Unknown mission state.')
 if(definition.requires&&!completed.includes(definition.requires))return bad('Mission unlock dependency is missing.')
 if(m.status==='NOT_STARTED'&&(definition.id!=='first-contact'||m.objectiveId!==null||completed.length!==0))return bad('Invalid unstarted mission.')
 if(m.status==='ACTIVE'&&(completed.includes(definition.id)||!definition.objectives.some(o=>o.id===m.objectiveId)))return bad('Invalid active objective.')
 if(m.status==='COMPLETED'&&(m.objectiveId!==null||completed[completed.length-1]!==definition.id))return bad('Invalid completed objective.')
 const mission:GuestSave['mission']={missionId:definition.id,status:m.status as MissionProgress['status'],objectiveId:m.objectiveId as MissionProgress['objectiveId'],completed}
 const vehicles:SavedVehiclePose[]=[],seen=new Set<string>()
 for(const pose of Array.isArray(value.vehicles)?value.vehicles:[]){if(plausiblePose(pose)&&!seen.has(pose.vehicleId)){seen.add(pose.vehicleId);vehicles.push({vehicleId:pose.vehicleId,x:pose.x,y:pose.y,z:pose.z,yaw:pose.yaw,layoutVersion:1})}}
 const claims:SavedParking[]=[]
 for(const record of Array.isArray(value.parking)?value.parking:[]){
  if(!object(record)||record.source!=='drive-in'||!object(record.pose))continue
  const pose=vehicles.find(v=>v.vehicleId===record.vehicleId),bay=GARAGE.bays.find(b=>b.id===record.bayId),d=VEHICLES.find(d=>d.id===record.vehicleId)
  if(!pose||!bay||!d||![record.pose.x,record.pose.y,record.pose.z,record.pose.yaw].every(finite))continue
  if(Math.hypot(Number(record.pose.x)-pose.x,Number(record.pose.z)-pose.z)>.03||Math.abs(Number(record.pose.y)-pose.y)>.05||Math.abs(Number(record.pose.yaw)-pose.yaw)>.02||!fitsParkingBay(d,{x:pose.x,y:pose.y,z:pose.z,yaw:pose.yaw,up:1},bay))continue
  claims.push({vehicleId:d.id,bayId:bay.id,source:'drive-in',pose:{x:pose.x,y:pose.y,z:pose.z,yaw:pose.yaw}})
 }
 const parking=claims.filter(c=>claims.filter(d=>d.vehicleId===c.vehicleId||d.bayId===c.bayId).length===1)
 const warning=vehicles.length!==3||parking.length!==(Array.isArray(value.parking)?value.parking.length:0)?'Some unsafe or conflicting vehicle/parking records were discarded.':''
 return {ok:true,save:{version:1,savedAt:Number(value.savedAt),mission,economy,claimedRewardIds:claimed,processedOperationIds:processed,vehicles,parking},warning}
}
