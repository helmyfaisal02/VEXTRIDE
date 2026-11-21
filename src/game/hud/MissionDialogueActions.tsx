import { useProgressSaveStore } from '../persistence/persistenceRuntime'
import { useEffect,useRef,useState } from 'react'
import type { NPCId } from '../npcs/npcConfig'
import { FIRST_CONTACT,missionDefinition } from '../missions/missionDefinitions'
import { availableMission,currentObjective,useMissionStore } from '../missions/missionState'
import { acceptMission,declineMission,acknowledgeObjective } from '../missions/missionManager'
const button='rounded-lg bg-white/15 px-3 py-2 text-sm hover:bg-white/25 focus-visible:outline focus-visible:outline-2'
/** Additive mission section; the NPC's normal three dialogue lines are never replaced. */
export function MissionDialogueActions({npcId,session}:{npcId:NPCId;session:number}){
 const blocked=useProgressSaveStore(s=>s.blocked)
 const progress=useMissionStore(s=>s.progress),[offering,setOffering]=useState(false),accept=useRef<HTMLButtonElement>(null)
 useEffect(()=>{if(offering)accept.current?.focus()},[offering])
 if(blocked)return null
 const offer=availableMission(progress,npcId)
 if(offer){
  return <div className="mb-4 rounded-xl border border-white/15 p-3" data-testid="mission-offer">
   {!offering?<button type="button" className={button} onClick={()=>setOffering(true)}>Start {offer.title}</button>:<>
    <h3 className="mb-2 text-sm font-semibold">{offer.title}</h3><p className="mb-3 text-sm leading-relaxed text-white/90">{offer.introduction}</p>
    <div className="flex flex-wrap gap-2"><button ref={accept} type="button" className={button} onClick={()=>acceptMission(session,offer.id)}>Accept {offer.title}</button><button type="button" className={button} onClick={()=>declineMission(session,offer.id)}>Not now</button></div>
   </>}
  </div>
 }
 const objective=currentObjective(progress)
 if(!objective)return null
 if(objective.npcId!==npcId)return progress.missionId!==FIRST_CONTACT.id&&npcId==='marcus'?<p className="mb-4 rounded-xl border border-white/15 p-3 text-sm text-white/80">Finish the three marked checkpoints in order, then come back and talk to me on foot.</p>:npcId===FIRST_CONTACT.giver&&progress.missionId===FIRST_CONTACT.id?<p className="mb-4 rounded-xl border border-white/15 p-3 text-sm text-white/80">Marcus is at the Motor Row garage. Come back after you've said hello.</p>:null
 return <div className="mb-4 rounded-xl border border-white/15 p-3" data-testid="mission-acknowledgement">
  <h3 className="mb-2 text-sm font-semibold">{missionDefinition(progress.missionId).title}</h3><p className="mb-3 text-sm leading-relaxed">{objective.acknowledgement}</p>
  <button type="button" className={button} onClick={()=>acknowledgeObjective(objective.id,session)}>{objective.action}</button>
 </div>
}
