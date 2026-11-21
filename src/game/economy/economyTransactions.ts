import { MISSION_REWARDS } from './economyConfig'
import { VEHICLE_PAINTS } from '../vehicles/vehiclePaint'
import type { EconomySnapshot,EconomyTransaction } from './economyState'
export type TransactionCommand=Omit<Extract<EconomyTransaction,{type:'EARN'}>,'sequence'|'balanceAfter'>|Omit<Extract<EconomyTransaction,{type:'SPEND'}>,'sequence'|'balanceAfter'>
export type EconomyResult={ok:true;economy:EconomySnapshot}|{ok:false;message:string}
/** Pure centralized integer ledger reducer. No UI exposes an arbitrary credit/debit action. */
export function transact(economy:EconomySnapshot,command:TransactionCommand):EconomyResult{
 if(!Number.isSafeInteger(command.amount)||command.amount<=0||!Number.isSafeInteger(economy.balance)||economy.balance<0||!command.id?.trim()||command.id.length>100||!command.reason?.trim()||!['EARN','SPEND'].includes(command.type))return {ok:false,message:'Invalid Street Cash transaction.'}
 if(command.type==='EARN'?!Object.prototype.hasOwnProperty.call(MISSION_REWARDS,command.missionId):!Object.prototype.hasOwnProperty.call(VEHICLE_PAINTS,command.vehicleId)||!VEHICLE_PAINTS[command.vehicleId].some(p=>p.id===command.paintId))return {ok:false,message:'Invalid Street Cash reference.'}
 if(economy.transactions.some(t=>t.id===command.id))return {ok:false,message:'This operation was already processed.'}
 const balance=economy.balance+(command.type==='EARN'?command.amount:-command.amount)
 if(!Number.isSafeInteger(balance)||balance<0)return {ok:false,message:'Insufficient Street Cash.'}
 const sequence=economy.sequence+1
 if(!Number.isSafeInteger(sequence))return {ok:false,message:'Invalid session sequence.'}
 return {ok:true,economy:{...economy,balance,sequence,transactions:[...economy.transactions,{...command,sequence,balanceAfter:balance}]}}
}
