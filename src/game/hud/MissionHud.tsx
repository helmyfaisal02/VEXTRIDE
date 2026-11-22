import { useEconomy } from '../economy/economySelectors'
import { useEffect,useRef } from 'react'
import { missionDefinition } from '../missions/missionDefinitions'
import { useVehicleStore,vehicleState } from '../vehicles/vehicleState'
import { useMissionStore } from '../missions/missionState'
import { missionHUD,targetReadout } from '../missions/missionPresentation'
import { playerState } from '../character/playerState'
import { useCharacterStore } from '../state/characterStore'
export function MissionHud(){
 const progress=useMissionStore(s=>s.progress),notice=useMissionStore(s=>s.completionNotice),creator=useCharacterStore(s=>s.menuOpen)
 const readout=useRef<HTMLParagraphElement>(null),view=missionHUD(progress)
 const reward=useEconomy(s=>s.transactions.find(t=>t.type==='EARN'&&t.missionId===progress.missionId))
 const target=view?.target
 useEffect(()=>{
  if(!target||creator)return
  const update=()=>{if(readout.current)readout.current.textContent=`${target.name} · ${targetReadout(useVehicleStore.getState().driving?vehicleState.position:playerState.position,target.spawn)}`}
  update();const timer=setInterval(update,250)
  return ()=>clearInterval(timer)
 },[target,creator])
 useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>useMissionStore.getState().dismissCompletion(),5000);return ()=>clearTimeout(timer)},[notice])
 if(creator)return null
 const style='max-w-xs rounded-xl border border-white/15 bg-[#142440]/90 px-4 py-3 text-white shadow-lg'
 if(notice)return <div role="status" className={style} data-testid="mission-complete"><p className="text-sm font-semibold">Mission Complete — {missionDefinition(progress.missionId).title}</p>{reward&&<p className="mt-2 text-xs text-[#70e4d1]" data-testid="mission-reward">+{reward.amount} SC — {reward.reason}</p>}</div>
 if(!view)return null
 return <div className={style} data-testid="mission-hud" aria-label="Active mission">
  <p className="text-xs font-semibold uppercase tracking-wide">{view.title}</p>
  <p className="mt-1 text-sm" role="status">◆ {view.objective}</p>
  <p ref={readout} className="mt-2 text-xs text-white/80" data-testid="mission-waypoint">{view.target.name}</p>
 </div>
}
