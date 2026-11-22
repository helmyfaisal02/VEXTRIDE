import { useEffect,useRef,useState } from 'react'
import { guestPersistence } from '../persistence/persistenceCoordinator'
import { useProgressSaveStore } from '../persistence/persistenceRuntime'
export function GuestProgressSettings(){
 const status=useProgressSaveStore(s=>s.status),message=useProgressSaveStore(s=>s.message),restoring=useProgressSaveStore(s=>s.restoring)
 const [resetting,setResetting]=useState(false)
 const [confirm,setConfirm]=useState(false),cancelButton=useRef<HTMLButtonElement>(null),resetButton=useRef<HTMLButtonElement>(null),returnFocus=useRef(false)
 useEffect(()=>{if(confirm)cancelButton.current?.focus();else if(returnFocus.current){returnFocus.current=false;resetButton.current?.focus()}},[confirm])
 const cancel=()=>{if(resetting)return;returnFocus.current=true;setConfirm(false)}
 const reset=()=>{
  if(resetting||status==='conflict')return
  setResetting(true)
  void Promise.resolve(guestPersistence.reset()).then(ok=>{
   if(ok)return
   setResetting(false);returnFocus.current=true;setConfirm(false)
  })
 }
 const button='rounded-lg bg-white/15 px-3 py-2 text-xs hover:bg-white/25 focus-visible:outline focus-visible:outline-2 disabled:opacity-40'
 return <section className="mt-4 rounded-xl border border-white/15 p-3 text-xs text-white/75" aria-label="Guest progress" data-testid="guest-progress-settings" onKeyDown={event=>{
  if(event.key==='Escape'&&confirm){event.preventDefault();event.stopPropagation();cancel()}
 }}>
  <h3 className="font-semibold text-white">Guest Progress · This Browser</h3>
  <p className="mt-2" role="status" data-testid="guest-save-status">{restoring?'Validating saved world positions…':message||'Local guest save is not initialized.'}</p>
  <p className="mt-2 text-[11px]">Local saves are not cloud backups. Character appearance is saved separately.</p>
  {confirm?<div className="mt-3 space-y-3"><p>Reset missions, Street Cash and its ledger, paint, vehicle positions, and garage parking? Your character, appearance, and Arc transfer history stay saved.</p><div className="flex flex-wrap gap-2"><button type="button" className={button} disabled={resetting||status==='conflict'} onClick={reset}>Confirm reset guest progress</button><button ref={cancelButton} type="button" className={button} disabled={resetting} onClick={cancel}>Cancel reset</button></div></div>:<button ref={resetButton} type="button" className={`${button} mt-3`} disabled={restoring||status==='idle'||status==='conflict'} onClick={()=>setConfirm(true)}>Reset guest progress</button>}
 </section>
}
export function GuestSaveWarning(){
 const status=useProgressSaveStore(s=>s.status),blocked=useProgressSaveStore(s=>s.blocked)
 if(!blocked&&!['error','memory'].includes(status))return null
 return <p role="status" className="max-w-[12rem] rounded-lg bg-[#142440]/95 px-2 py-1 text-xs text-amber-200" data-testid="guest-save-warning">{status==='conflict'?'Guest save changed in another tab. Reload to continue saving.':blocked?'Guest save needs attention. Reset is available at the garage.':'Local save unavailable. Progress may be lost on reload.'}</p>
}
