import { useEffect,useRef,useState } from 'react'
import type { NPCId } from '../npcs/npcConfig'
import { FIRST_CONTACT } from '../missions/missionDefinitions'
import { currentObjective,useMissionStore } from '../missions/missionState'
import { acceptMission,declineMission,acknowledgeObjective } from '../missions/missionManager'
const button='rounded-lg bg-white/15 px-3 py-2 text-sm hover:bg-white/25 focus-visible:outline focus-visible:outline-2'
/** Additive mission section; the NPC's normal three dialogue lines are never replaced. */
export function MissionDialogueActions({npcId,session}:{npcId:NPCId;session:number}){
 const progress=useMissionStore(s=>s.progress),[offering,setOffering]=useState(false),accept=useRef<HTMLButtonElement>(null)
 useEffect(()=>{if(offering)accept.current?.focus()},[offering])
 if(progress.status==='COMPLETED')return null
 if(progress.status==='NOT_STARTED'){
  if(npcId!==FIRST_CONTACT.giver)return null
  return <div className="mb-4 rounded-xl border border-white/15 p-3" data-testid="mission-offer">
   {!offering?<button type="button" className={button} onClick={()=>setOffering(true)}>Start First Contact</button>:<>
    <h3 className="mb-2 text-sm font-semibold">First Contact</h3><p className="mb-3 text-sm leading-relaxed text-white/90">{FIRST_CONTACT.introduction}</p>
    <div className="flex flex-wrap gap-2"><button ref={accept} type="button" className={button} onClick={()=>acceptMission(session)}>Accept First Contact</button><button type="button" className={button} onClick={()=>declineMission(session)}>Not now</button></div>
   </>}
  </div>
 }
 const objective=currentObjective(progress)
 if(!objective)return null
 if(objective.npcId!==npcId)return npcId===FIRST_CONTACT.giver?<p className="mb-4 rounded-xl border border-white/15 p-3 text-sm text-white/80">Marcus is at the Motor Row garage. Come back after you've said hello.</p>:null
 return <div className="mb-4 rounded-xl border border-white/15 p-3" data-testid="mission-acknowledgement">
  <h3 className="mb-2 text-sm font-semibold">First Contact</h3><p className="mb-3 text-sm leading-relaxed">{objective.acknowledgement}</p>
  <button type="button" className={button} onClick={()=>acknowledgeObjective(objective.id,session)}>{objective.action}</button>
 </div>
}
