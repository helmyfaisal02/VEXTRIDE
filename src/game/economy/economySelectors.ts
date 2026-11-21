import { useMissionStore } from '../missions/missionState'
import type { EconomySnapshot } from './economyState'
/** Mission progress and economy share one Zustand atom for atomic completion/reward and debit/paint. */
export function useEconomy<T>(select:(state:EconomySnapshot)=>T){return useMissionStore(s=>select(s.economy))}
export const getEconomy=()=>useMissionStore.getState().economy
export const formatSC=(amount:number)=>`${amount.toLocaleString('en-US')} SC`
