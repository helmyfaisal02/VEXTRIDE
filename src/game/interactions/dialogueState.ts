import { create } from 'zustand'
import { resetInput } from '../input/inputState'
import { useCharacterStore } from '../state/characterStore'
import { useVehicleStore,vehicleRuntime } from '../vehicles/vehicleState'
import type { NPCDefinition } from '../npcs/npcConfig'
export const useDialogueStore=create<{
 active:NPCDefinition|null;line:number;hint:string
 open:(npc:NPCDefinition)=>void;close:()=>void;advance:()=>void;setHint:(hint:string)=>void
}>((set,get)=>({
 active:null,line:0,hint:'',
 open:(npc)=>{
  if(get().active||useCharacterStore.getState().menuOpen||useVehicleStore.getState().driving)return
  resetInput()
  const body=vehicleRuntime.pedestrian
  if(body?.isValid()){const v=body.linvel();body.setLinvel({x:0,y:v.y,z:0},true)}
  set({active:npc,line:0,hint:''})
 },
 close:()=>{resetInput();set({active:null,line:0,hint:''})},
 advance:()=>{const s=get();if(!s.active)return;if(s.line+1>=s.active.lines.length)s.close();else set({line:s.line+1})},
 setHint:(hint)=>set(s=>s.hint===hint?s:{hint}),
}))
