import { useEffect,useRef,useState } from 'react'
import { GARAGE } from '../garage/garageConfig'
import { garageCatalog } from '../garage/garageCatalog'
import { useGarageStore } from '../garage/garageState'
function OpenGaragePanel(){
 const occupancy=useGarageStore(s=>s.occupancy),[selected,setSelected]=useState(0),close=useRef<HTMLButtonElement>(null)
 const catalog=garageCatalog(occupancy),vehicle=catalog[selected]
 useEffect(()=>{const previous=document.activeElement,button=close.current;button?.focus();return ()=>{if(previous instanceof HTMLElement&&previous.isConnected)previous.focus();else button?.blur()}},[])
 return <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-black/35 p-4" onPointerDown={e=>e.stopPropagation()}>
  <section role="dialog" aria-modal="true" aria-labelledby="garage-title" aria-describedby="garage-help" data-testid="garage-panel" className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/20 bg-[#142440]/95 p-5 text-white shadow-xl" onKeyDown={e=>{
   if(e.key!=='Tab')return
   const buttons=Array.from(e.currentTarget.querySelectorAll('button'))
   if(e.shiftKey&&document.activeElement===buttons[0]){e.preventDefault();buttons[buttons.length-1]?.focus()}
   else if(!e.shiftKey&&document.activeElement===buttons[buttons.length-1]){e.preventDefault();buttons[0]?.focus()}
  }}>
   <header className="flex items-start justify-between gap-3"><div><h2 id="garage-title" className="font-semibold uppercase tracking-wide">Motor Row Garage</h2><p className="mt-1 text-xs text-white/65">Exterior service terminal · Vehicle overview</p></div><button ref={close} type="button" aria-label="Close garage" className="rounded-lg bg-white/10 px-3 py-2 focus-visible:outline focus-visible:outline-2" onClick={()=>useGarageStore.getState().close()}>Close</button></header>
   <p className="my-4 text-sm" role="status" data-testid="garage-occupancy">{Object.keys(occupancy).length} / {GARAGE.bays.length} bays occupied</p>
   <div className="grid gap-4 sm:grid-cols-[1fr_1.2fr]">
    <div className="space-y-2" aria-label="Available city vehicles">{catalog.map((v,i)=><button key={v.id} type="button" aria-pressed={selected===i} className={`w-full rounded-xl border p-3 text-left focus-visible:outline focus-visible:outline-2 ${selected===i?'border-[#70e4d1] bg-white/10':'border-white/15 hover:bg-white/5'}`} onClick={()=>setSelected(i)}>
     <span className="block text-sm font-semibold">{v.name}</span><span className="mt-1 block text-xs text-white/65">{v.bayId?'Parked at Garage':v.present?'Available in City · Elsewhere':'Not in scene'}</span>
    </button>)}</div>
    <div className="rounded-xl border border-white/15 p-4" data-testid="garage-vehicle-overview"><h3 className="text-sm font-semibold">{vehicle.name}</h3><dl className="mt-3 space-y-2 text-sm"><div><dt className="text-xs text-white/60">Type</dt><dd>{vehicle.type}</dd></div><div><dt className="text-xs text-white/60">Length × Width × Height</dt><dd>{vehicle.dimensions}</dd></div><div><dt className="text-xs text-white/60">Top-speed specification</dt><dd>{vehicle.topSpeed} km/h</dd></div></dl><p className="mt-3 text-sm leading-relaxed text-white/80">{vehicle.description}</p><p className="mt-3 text-sm" data-testid="garage-selected-status">{vehicle.bayId?`Parked at Garage — ${GARAGE.bays.find(b=>b.id===vehicle.bayId)?.name}`:vehicle.present?'Elsewhere in the city':'Not currently in the scene'}</p></div>
   </div>
   <div className="mt-4 flex flex-wrap gap-3 text-xs text-white/70">{GARAGE.bays.map(b=><p key={b.id}>{b.name}: {occupancy[b.id]?catalog.find(v=>v.id===occupancy[b.id])?.name:'Available'}</p>)}</div>
   <p id="garage-help" className="mt-4 text-xs leading-relaxed text-white/65">The teal corner markers identify two existing stalls in the north parking lot behind the garage. Drive fully inside, align with the stall, stop and exit. Parking confirms after one stationary second. Drive away to free the bay. Esc to close.</p>
  </section>
 </div>
}
export function GaragePanel(){
 const open=useGarageStore(s=>s.open),hint=useGarageStore(s=>s.hint)
 if(open)return <OpenGaragePanel/>
 return hint?<p className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 rounded-xl bg-[#142440]/95 px-4 py-2 text-xs text-white" data-testid="garage-hint">{hint}</p>:null
}
