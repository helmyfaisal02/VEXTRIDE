import { useRef } from 'react'
import { useDialogueStore } from '../interactions/dialogueState'
import { MissionDialogueActions } from './MissionDialogueActions'
import { useModalFocus } from './useModalFocus'
import { useCharacterStore } from '../state/characterStore'
export function NPCDialogue(){
 const active=useDialogueStore(s=>s.active),line=useDialogueStore(s=>s.line)
 const session=useDialogueStore(s=>s.session)
 const creator=useCharacterStore(s=>s.menuOpen),close=useRef<HTMLButtonElement>(null)
 const panel=useRef<HTMLElement>(null)
 const containFocus=useModalFocus(panel,close,!!active&&!creator)
 if(creator||!active)return null
 return <section ref={panel} role="dialog" aria-modal="true" aria-labelledby="npc-title" aria-describedby="npc-line" data-testid="npc-dialogue" className="vex-overlay pointer-events-auto absolute bottom-5 left-1/2 z-20 max-h-[70dvh] w-[calc(100%_-_2rem)] max-w-md -translate-x-1/2 overflow-y-auto rounded-2xl border border-white/20 bg-[#142440]/95 p-4 text-white shadow-xl sm:p-5" onKeyDown={containFocus}>
  <div className="flex items-start justify-between gap-3"><div><h2 id="npc-title" className="font-semibold">{active.name}</h2><p className="text-xs text-white/65">{active.role}</p></div><button ref={close} type="button" aria-label="Close conversation" className="rounded bg-white/10 px-3 py-1 hover:bg-white/10 focus-visible:outline focus-visible:outline-2" onClick={()=>useDialogueStore.getState().close()}>×</button></div>
  <p id="npc-line" aria-live="polite" className="my-4 text-sm leading-relaxed">{active.lines[line]}</p>
  <MissionDialogueActions key={session} npcId={active.id} session={session}/>
  <div className="flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-white/75">{line+1} / {active.lines.length} · Esc to close</span><button type="button" className="rounded-lg bg-white/15 px-4 py-2 text-sm hover:bg-white/25 focus-visible:outline focus-visible:outline-2" onClick={()=>useDialogueStore.getState().advance()}>{line+1<active.lines.length?'Continue':'Close'}</button></div>
 </section>
}
