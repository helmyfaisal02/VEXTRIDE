import type { useRapier,RapierRigidBody } from '@react-three/rapier'
import { GARAGE } from './garageConfig'
import { garageRuntime } from './garageState'
type Physics=Pick<ReturnType<typeof useRapier>,'world'|'rapier'>
export function canUseGarage(physics:Physics,player:RapierRigidBody){
 const terminal=garageRuntime.terminal,t=GARAGE.terminal,p=player.translation()
 if(!terminal?.isValid()||!player.isEnabled()||Math.hypot(p.x-t.x,p.z-t.z)>t.range||Math.abs(p.y-t.y-.9)>1.4)return false
 const origin={x:p.x,y:p.y+.4,z:p.z},dy=t.y+1.25-origin.y,dx=t.x-origin.x,dz=t.z-origin.z,len=Math.hypot(dx,dy,dz)
 return len<.01||!physics.world.castRay(new physics.rapier.Ray(origin,{x:dx/len,y:dy/len,z:dz/len}),len,true,physics.rapier.QueryFilterFlags.EXCLUDE_SENSORS,undefined,undefined,player,c=>c.parent()?.handle!==terminal.handle)
}
