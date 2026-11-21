import type { MissionProgress } from '../missions/missionState'
import type { EconomySnapshot } from './economyState'
import { MISSION_REWARDS } from './economyConfig'
import { transact } from './economyTransactions'
/** Called synchronously inside the validated mission transition, never in a React effect. */
export function rewardMissionCompletion(economy:EconomySnapshot,previous:MissionProgress,next:MissionProgress):EconomySnapshot{
 if(previous.status!=='ACTIVE'||next.status!=='COMPLETED'||previous.missionId!==next.missionId||previous.completed?.includes(next.missionId)||!next.completed?.includes(next.missionId))return economy
 const reward=MISSION_REWARDS[next.missionId]
 if(!reward)return economy
 const result=transact(economy,{id:`mission:${next.missionId}`,type:'EARN',amount:reward.amount,reason:reward.reason,missionId:next.missionId})
 return result.ok?result.economy:economy
}
