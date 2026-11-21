import { useEffect,useRef,useState } from 'react'
import type { VehicleId } from '../vehicles/vehicleConfig'
import { VEHICLE_PAINTS,paintPreset,type PaintId } from '../vehicles/vehiclePaint'
import { useEconomy,formatSC } from '../economy/economySelectors'
import { STREET_CASH } from '../economy/economyConfig'
import { newResprayOperationId,type ResprayRequest } from '../economy/garageResprayService'
import { useMissionStore } from '../missions/missionState'
const button='rounded-lg bg-white/15 px-3 py-2 text-sm hover:bg-white/25 focus-visible:outline focus-visible:outline-2 disabled:opacity-40'
export function GarageRespray({vehicleId,name,parked}:{vehicleId:VehicleId;name:string;parked:boolean}){
 const current=useEconomy(s=>s.paints[vehicleId]),balance=useEconomy(s=>s.balance)
 const [selected,setSelected]=useState<PaintId>(current),[pending,setPending]=useState<ResprayRequest|null>(null),[result,setResult]=useState<{ok:boolean;message:string}|null>(null)
 const confirm=useRef<HTMLButtonElement>(null),review=useRef<HTMLButtonElement>(null),returnFocus=useRef(false),submitted=useRef('')
 useEffect(()=>{if(pending)confirm.current?.focus();else if(returnFocus.current){returnFocus.current=false;review.current?.focus()}},[pending])
 const cancel=()=>{returnFocus.current=true;setPending(null);setResult(null)}
 return <section className="mt-4 rounded-xl border border-white/15 p-4" aria-label="Vehicle body respray" data-testid="respray-service">
  <h3 className="text-sm font-semibold">Vehicle Body Respray · {STREET_CASH.resprayPrice} SC</h3>
  <p className="mt-2 text-xs text-white/70">{name} · Current color: <span data-testid="current-paint">{paintPreset(vehicleId,current)!.name}</span></p>
  {!parked&&<p className="mt-2 text-xs text-white/70">Park this vehicle fully in a marked bay, stop and exit to use this service.</p>}
  <label className="mt-3 flex flex-wrap items-center gap-3 text-sm">New body color
   <select aria-label="New body color" disabled={!!pending} value={selected} onChange={e=>{setSelected(e.target.value as PaintId);setResult(null)}} className="rounded-lg bg-[#304563] p-2">{VEHICLE_PAINTS[vehicleId].map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
   <span aria-hidden="true" className="h-5 w-8 rounded border border-white/30" style={{background:paintPreset(vehicleId,selected)!.color}}/>
  </label>
  <p className="mt-2 text-xs text-white/70">Balance: {formatSC(balance)}</p>
  {pending?<div className="mt-3 space-y-3" data-testid="respray-confirmation"><p className="text-sm">Respray {name} to {paintPreset(vehicleId,pending.paintId)!.name} for {STREET_CASH.resprayPrice} SC?</p><div className="flex flex-wrap gap-2">
   <button ref={confirm} type="button" className={button} onClick={()=>{
    if(submitted.current===pending.operationId)return
    submitted.current=pending.operationId
    const response=useMissionStore.getState().confirmRespray(pending)
    setResult(response);returnFocus.current=true;setPending(null)
   }}>Confirm respray — {STREET_CASH.resprayPrice} SC</button><button type="button" className={button} onClick={cancel}>Cancel respray</button>
  </div></div>:<button ref={review} type="button" disabled={!parked} className={`${button} mt-3`} onClick={()=>{setResult(null);setPending({operationId:newResprayOperationId(),vehicleId,paintId:selected})}}>Review respray</button>}
  {result&&<p role={result.ok?'status':'alert'} className="mt-3 text-sm" data-testid="respray-result">{result.message}</p>}
  <p className="mt-3 text-[11px] text-white/55">Street Cash is fictional game currency. Check Guest Progress below for local-save status.</p>
 </section>
}
export function GarageEconomyHistory(){
 const transactions=useEconomy(s=>s.transactions)
 return <section className="mt-4 text-xs text-white/70" aria-label="Recent Street Cash activity"><h3 className="font-semibold">Recent Street Cash activity</h3>{transactions.length?<ol className="mt-2 space-y-1">{transactions.slice(-5).reverse().map(t=><li key={t.id}>#{t.sequence} · {t.type==='EARN'?'+':'−'}{formatSC(t.amount)} · {t.reason} · Balance {formatSC(t.balanceAfter)}</li>)}</ol>:<p className="mt-2">No activity this session.</p>}</section>
}
