import type { MissionId } from '../missions/missionDefinitions'
export const STREET_CASH={name:'STREET CASH',unit:'SC',startingBalance:0,resprayPrice:125} as const
export const MISSION_REWARDS:Readonly<Record<MissionId,{amount:number;reason:string}>>={
 'first-contact':{amount:150,reason:'First Contact Complete'},
 'motor-row-shakedown':{amount:300,reason:'Motor Row Shakedown Complete'},
}
