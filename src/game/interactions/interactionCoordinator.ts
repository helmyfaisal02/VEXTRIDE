import { isRestoringProgress } from '../persistence/persistenceRuntime'
import type { useRapier,RapierRigidBody } from '@react-three/rapier'
import { inputState,isWalletPanelOpen,resetInput } from '../input/inputState'
import { useCharacterStore } from '../state/characterStore'
import { nearestVehicle,processVehicleInteraction } from '../vehicles/vehicleInteraction'
import { useVehicleStore,vehicleRuntime } from '../vehicles/vehicleState'
import { npcRegistry } from '../npcs/npcState'
import { canUseGarage } from '../garage/garageInteraction'
import { GARAGE } from '../garage/garageConfig'
import { useGarageStore } from '../garage/garageState'
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
 let selected:{kind:'npc';npc:NonNullable<typeof npc>}|{kind:'vehicle';car:NonNullable<typeof car>}|{kind:'garage'}|null=null
 if(npc&&(!car||Math.hypot(npc.body.translation().x-p.x,npc.body.translation().z-p.z)<Math.hypot(car.body!.translation().x-p.x,car.body!.translation().z-p.z)))selected={kind:'npc',npc}
 else if(car)selected={kind:'vehicle',car}
 const distance=selected?.kind==='npc'?Math.hypot(selected.npc.body.translation().x-p.x,selected.npc.body.translation().z-p.z):selected?.kind==='vehicle'?Math.hypot(selected.car.body!.translation().x-p.x,selected.car.body!.translation().z-p.z):Infinity
 return canUseGarage(physics,player)&&Math.hypot(GARAGE.terminal.x-p.x,GARAGE.terminal.z-p.z)<distance?{kind:'garage' as const}:selected
}
export function processInteraction(physics:Physics){
 if(isRestoringProgress()||isWalletPanelOpen()){resetInput();return}
 const dialogue=useDialogueStore.getState(),vehicle=useVehicleStore.getState(),garage=useGarageStore.getState()
 if(useCharacterStore.getState().menuOpen){if(dialogue.active)dialogue.close();if(garage.open)garage.close();garage.setHint('');return}
 if(vehicle.driving){if(garage.open)garage.close();garage.setHint('');if(dialogue.active)dialogue.close();dialogue.setHint('');processVehicleInteraction(physics);return}
 if(dialogue.active){if(garage.open)garage.close();garage.setHint('');resetInput();return}
 if(garage.open){resetInput();return}
 const player=vehicleRuntime.pedestrian
 if(!player?.isValid())return
 const target=walkingTarget(physics,player)
 if(target?.kind==='garage'){
  vehicle.setHint('');dialogue.setHint('');garage.setHint('E — Open Garage')
  if(inputState.interactQueued){inputState.interactQueued=false;garage.show()}
 }else if(target?.kind==='npc'){
  garage.setHint('')
  vehicle.setHint('');dialogue.setHint(`E — Talk to ${target.npc.definition.name} · ${target.npc.definition.role}`)
  if(inputState.interactQueued){inputState.interactQueued=false;dialogue.open(target.npc.definition)}
 }else{
  garage.setHint('');dialogue.setHint('');processVehicleInteraction(physics,target?.kind==='vehicle'?target.car:null)
 }
}
