import { CITY } from '../city/cityLayout'
import { ROAD_TOP } from '../city/cityConfig'
import { DRIVEWAYS } from '../city/driveways'

/** Clockwise Motor Row circuit, using only existing directed lanes and legal turns. */
export const SHAKEDOWN_LANES = ['RX03:E','RZ40:S','RX13:W'] as const
export type CheckpointId = 'checkpoint-a'|'checkpoint-b'|'checkpoint-c'
export const CHECKPOINTS = SHAKEDOWN_LANES.map((id,index)=>{
 const lane=CITY.laneEdges.find(l=>l.id===id)!
 const t=index===0?.74:.5
 return {id:['checkpoint-a','checkpoint-b','checkpoint-c'][index] as CheckpointId,
  name:`Checkpoint ${['A','B','C'][index]}`,order:index,laneId:id,
  spawn:{x:lane.start.x+(lane.end.x-lane.start.x)*t,y:ROAD_TOP,z:lane.start.z+(lane.end.z-lane.start.z)*t},
  direction:lane.dir,halfWidth:1.8}
})
export function validateCheckpointRoute(){
 const lanes=SHAKEDOWN_LANES.map(id=>CITY.laneEdges.find(l=>l.id===id)!)
 const entrance=DRIVEWAYS.find(d=>d.id==='north-parking')!
 return lanes.every(Boolean)&&entrance.roadId===lanes[0].roadId&&entrance.center<CHECKPOINTS[0].spawn.x&&
  lanes.slice(1).every((l,i)=>CITY.movements.some(m=>m.from===lanes[i].id&&m.to===l.id))&&
  CHECKPOINTS.every((gate,i)=>{
   const lane=lanes[i],road=CITY.roads.find(r=>r.id===lane.roadId)!,p=gate.spawn
   return p.x>road.rect.minX&&p.x<road.rect.maxX&&p.z>road.rect.minZ&&p.z<road.rect.maxZ
  })
}
