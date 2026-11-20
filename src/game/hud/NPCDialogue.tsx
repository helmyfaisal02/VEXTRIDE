import { useEffect,useRef } from 'react'
import { useDialogueStore } from '../interactions/dialogueState'
import { MissionDialogueActions } from './MissionDialogueActions'
import { useCharacterStore } from '../state/characterStore'
export function NPCDialogue(){
 const active=useDialogueStore(s=>s.active),line=useDialogueStore(s=>s.line),hint=useDialogueStore(s=>s.hint)
 const session=useDialogueStore(s=>s.session)
 const creator=useCharacterStore(s=>s.menuOpen),close=useRef<HTMLButtonElement>(null)
 useEffect(()=>{
  if(!active)return
  const previous=document.activeElement
  const button=close.current
  button?.focus()
  return ()=>{if(previous instanceof HTMLElement&&previous.isConnected)previous.focus();else button?.blur()}
 },[active])
 if(creator)return null
 if(!active)return hint?<p className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 rounded-xl bg-[#142440]/95 px-4 py-2 text-xs text-white" data-testid="npc-hint">{hint}</p>:null
 return <section role="dialog" aria-modal="true" aria-labelledby="npc-title" aria-describedby="npc-line" data-testid="npc-dialogue" className="pointer-events-auto absolute bottom-5 left-1/2 z-20 w-[calc(100%_-_2rem)] max-w-md max-h-[70vh] overflow-y-auto -translate-x-1/2 rounded-2xl border border-white/20 bg-[#142440]/95 p-5 text-white shadow-xl" onKeyDown={e=>{
  if(e.key!=='Tab')return
  const buttons=Array.from(e.currentTarget.querySelectorAll('button'))
  if(e.shiftKey&&document.activeElement===buttons[0]){e.preventDefault();buttons[buttons.length-1]?.focus()}
  else if(!e.shiftKey&&document.activeElement===buttons[buttons.length-1]){e.preventDefault();buttons[0]?.focus()}
 }}>
  <div className="flex items-start justify-between gap-3"><div><h2 id="npc-title" className="font-semibold">{active.name}</h2><p className="text-xs text-white/65">{active.role}</p></div><button ref={close} type="button" aria-label="Close conversation" className="rounded px-2 py-1 hover:bg-white/10 focus-visible:outline focus-visible:outline-2" onClick={()=>useDialogueStore.getState().close()}>×</button></div>
  <p id="npc-line" aria-live="polite" className="my-4 text-sm leading-relaxed">{active.lines[line]}</p>
  <MissionDialogueActions key={session} npcId={active.id} session={session}/>
  <div className="flex items-center justify-between gap-3"><span className="text-xs text-white/55">{line+1} / {active.lines.length} · Esc to close</span><button type="button" className="rounded-lg bg-white/15 px-4 py-2 text-sm hover:bg-white/25 focus-visible:outline focus-visible:outline-2" onClick={()=>useDialogueStore.getState().advance()}>{line+1<active.lines.length?'Continue':'Close'}</button></div>
 </section>
}
