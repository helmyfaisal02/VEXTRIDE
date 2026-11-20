import type { useRapier,RapierRigidBody } from '@react-three/rapier'
import { inputState,resetInput } from '../input/inputState'
import { useCharacterStore } from '../state/characterStore'
import { nearestVehicle,processVehicleInteraction } from '../vehicles/vehicleInteraction'
import { useVehicleStore,vehicleRuntime } from '../vehicles/vehicleState'
import { npcRegistry } from '../npcs/npcState'
import { useDialogueStore } from './dialogueState'
type Physics=Pick<ReturnType<typeof useRapier>,'world'|'rapier'>
export function nearestNPC(physics:Physics,player:RapierRigidBody){
 const p=player.translation();let selected:ReturnType<typeof npcRegistry.get>,distance=Infinity
 for(const npc of npcRegistry.values()){
  if(!npc.body.isValid())continue
  const d=npc.definition,n=npc.body.translation(),horizontal=Math.hypot(n.x-p.x,n.z-p.z)
  if(horizontal>d.range||Math.abs(p.y-(d.spawn.y+.9))>1.4)continue
  const target={x:n.x,y:d.spawn.y+1.3,z:n.z},origin={x:p.x,y:p.y+.4,z:p.z}
  const dx=target.x-origin.x,dy=target.y-origin.y,dz=target.z-origin.z,len=Math.hypot(dx,dy,dz)
  const blocked=len>.01&&physics.world.castRay(new physics.rapier.Ray(origin,{x:dx/len,y:dy/len,z:dz/len}),len,true,physics.rapier.QueryFilterFlags.EXCLUDE_SENSORS,undefined,undefined,player,c=>c.parent()?.handle!==npc.body.handle)
  if(!blocked&&(horizontal<distance||(horizontal===distance&&d.id<(selected?.definition.id??'~')))){selected=npc;distance=horizontal}
 }
 return selected
}
/** One decision point for walking E; exact ties favor the pre-existing vehicle interaction. */
export function walkingTarget(physics:Physics,player:RapierRigidBody){
 const car=nearestVehicle(physics,player),npc=nearestNPC(physics,player),p=player.translation()
 if(npc&&(!car||Math.hypot(npc.body.translation().x-p.x,npc.body.translation().z-p.z)<Math.hypot(car.body!.translation().x-p.x,car.body!.translation().z-p.z)))return {kind:'npc' as const,npc}
 return car?{kind:'vehicle' as const,car}:null
}
export function processInteraction(physics:Physics){
 const dialogue=useDialogueStore.getState(),vehicle=useVehicleStore.getState()
 if(useCharacterStore.getState().menuOpen){if(dialogue.active)dialogue.close();return}
 if(vehicle.driving){if(dialogue.active)dialogue.close();dialogue.setHint('');processVehicleInteraction(physics);return}
 if(dialogue.active){resetInput();return}
 const player=vehicleRuntime.pedestrian
 if(!player?.isValid())return
 const target=walkingTarget(physics,player)
 if(target?.kind==='npc'){
  vehicle.setHint('');dialogue.setHint(`E — Talk to ${target.npc.definition.name} · ${target.npc.definition.role}`)
  if(inputState.interactQueued){inputState.interactQueued=false;dialogue.open(target.npc.definition)}
 }else{
  dialogue.setHint('');processVehicleInteraction(physics)
 }
}
