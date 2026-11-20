import { GeometryBuilder } from '../city/geometryBuilder'
import { modelBox as box } from '../vehicles/modelPrimitives'
import type { NPCDefinition } from './npcConfig'
/** Five vertex-colored meshes per humanoid, with separate lightweight idle pivots. */
export function createNPCGeometry(d:NPCDefinition){
 const base=new GeometryBuilder(),torso=new GeometryBuilder(),head=new GeometryBuilder(),left=new GeometryBuilder(),right=new GeometryBuilder()
 const mechanic=d.appearance==='mechanic',skin=mechanic?'#a76c46':'#b47c5b',jacket=mechanic?'#566269':'#79588b',pants=mechanic?'#293943':'#303443',hair=mechanic?'#302820':'#24202b'
 for(const s of[-1,1]){
  box(base,s*.11,.075,.045,.18,.15,.32,mechanic?'#554638':'#a3a8b2')
  box(base,s*.10,.51,0,.17,.72,.20,pants)
 }
 box(base,0,.89,0,.39,.20,.23,pants)
 box(torso,0,.20,0,.46,.50,.25,jacket)
 box(torso,0,.18,.132,.026,.45,.014,mechanic?'#b8b9ad':'#d7b45d')
 if(mechanic){
  box(torso,0,.17,.145,.32,.30,.045,'#bc8b49') // work bib
  for(const s of[-1,1]){box(torso,s*.13,.35,.14,.045,.20,.025,'#bc8b49');box(torso,s*.115,.16,.174,.10,.10,.015,'#846237')}
  box(torso,.15,.21,.19,.035,.12,.025,'#c7cdd0') // pocket tool
 }else{
  box(torso,-.13,.27,.15,.075,.10,.025,'#dec45e') // dispatcher badge
  box(torso,.14,.09,.15,.075,.14,.03,'#27323c') // clipped radio
 }
 box(head,0,-.04,0,.13,.16,.14,skin)
 box(head,0,.13,0,.30,.32,.27,skin)
 box(head,0,.29,-.005,.33,.10,.29,mechanic?'#344657':hair)
 for(const s of[-1,1]){
  box(head,s*.073,.16,.14,.032,.035,.015,'#25262c')
  const arm=s<0?left:right
  box(arm,0,-.17,0,.15,.34,.19,jacket);box(arm,0,-.39,.012,.13,.15,.16,skin)
 }
 box(head,0,.055,.14,.065,.017,.012,'#704c42')
 if(mechanic){box(head,0,.25,.18,.34,.035,.20,'#344657');box(head,0,-.005,.02,.26,.055,.24,hair)}
 else{
  for(const s of[-1,1])box(head,s*.155,.12,-.025,.07,.31,.26,hair)
  box(head,.20,.13,0,.06,.11,.11,'#dab85d');box(head,.19,.04,.16,.035,.03,.23,'#dab85d')
 }
 return {base:base.build(),torso:torso.build(),head:head.build(),left:left.build(),right:right.build()}
}
export function npcIdle(time:number,phase:number){return {breath:1+Math.sin(time*1.8+phase)*.008,head:Math.sin(time*.65+phase)*.055,left:.035+Math.sin(time*1.3+phase)*.018,right:-.035+Math.sin(time*1.3+phase+1)*.018}}
