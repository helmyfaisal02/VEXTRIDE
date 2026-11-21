import { GeometryBuilder } from '../city/geometryBuilder'
import { modelBox } from '../vehicles/modelPrimitives'
import { GARAGE } from './garageConfig'
export function createGarageGeometry(){
 const shell=new GeometryBuilder(),screen=new GeometryBuilder(),paint=new GeometryBuilder()
 modelBox(shell,0,.05,0,.7,.1,.45,'#35465a');modelBox(shell,0,.65,0,.24,1.2,.23,'#52667a')
 modelBox(shell,0,1.28,0,.7,.64,.32,'#253951');modelBox(screen,0,1.28,.164,.57,.43,.016,'#70e4d1')
 // Original geometric G emblem on the terminal face, no font/network asset.
 for(const [x,y,w,h] of [[-.13,1.28,.035,.25],[0,1.4,.29,.035],[0,1.16,.29,.035],[.13,1.22,.035,.13],[.075,1.28,.15,.035]])modelBox(shell,x,y,.18,w,h,.018,'#142440')
 for(const b of GARAGE.bays){
  // Small inset corner brackets highlight the two existing stalls, not new pavement.
  for(const x of[-1,1])for(const z of[-1,1]){
   const cx=b.x+x*(b.width/2-.06),cz=b.z+z*(b.length/2-.06)
   paint.box({minX:cx-.035,maxX:cx+.035,minZ:Math.min(cz,cz-z*.6),maxZ:Math.max(cz,cz-z*.6)},b.y+.009,b.y+.012,'#70e4d1')
   paint.box({minX:Math.min(cx,cx-x*.45),maxX:Math.max(cx,cx-x*.45),minZ:cz-.035,maxZ:cz+.035},b.y+.009,b.y+.012,'#70e4d1')
  }
 }
 return {shell:shell.build(),screen:screen.build(),paint:paint.build()}
}
