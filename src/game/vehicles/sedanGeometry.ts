import { modelParts,modelBox as box,belt,finishModel } from './modelPrimitives'

/** Original four-door saloon: longer roof, separate trunk and two side-door outlines. */
export function createSedanAssets() {
  const p=modelParts(),{body,glass,trim,head,tail}=p
  const paint='#667da6',black='#18232d',window='#8aa6b5'
  belt(body,[[-2.3,.72,.18],[-1.85,.89,.27],[-1.1,.90,.29],[1.38,.90,.29],[1.95,.88,.22],[2.3,.74,.16]],paint)
  box(body,0,-.11,0,1.75,.42,2.04,paint)
  box(body,0,-.12,-2.12,1.5,.4,.36,paint);box(body,0,-.12,2.12,1.5,.4,.36,paint)
  box(body,0,.92,.125,1.34,.06,1.55,paint)
  glass.quad([-.75,.29,-1.12],[.75,.29,-1.12],[.67,.89,-.65],[-.67,.89,-.65],[0,.7,-.7],window)
  glass.quad([.75,.29,1.45],[-.75,.29,1.45],[-.67,.89,.9],[.67,.89,.9],[0,.7,.7],window)
  for(const s of[-1,1]){
    glass.quad([s*.77,.29,-1.04],[s*.77,.29,.08],[s*.67,.89,.08],[s*.67,.89,-.60],[s,0,0],window)
    glass.quad([s*.77,.29,.17],[s*.77,.29,1.36],[s*.67,.89,.85],[s*.67,.89,.17],[s,0,0],window)
    box(trim,s*.725,.59,.125,.11,.65,.07,black)
    // Separate lower door seams and one handle per door.
    box(trim,s*.882,-.005,.12,.015,.47,.018,black)
    for(const z of[-.43,.88])box(trim,s*.89,.19,z,.025,.045,.23,'#d9e0e3')
    box(trim,s*.89,.39,-.72,.07,.10,.18,black)
    box(trim,s*.87,-.30,0,.045,.04,2.04,black)
    box(head,s*.53,.08,-2.305,.36,.15,.02,'#f7edd5')
    box(tail,s*.53,.10,2.305,.39,.12,.02,'#fb3846')
  }
  box(trim,0,-.08,-2.303,.61,.13,.02,black)
  box(trim,0,-.20,2.305,1.30,.055,.025,black)
  box(trim,0,.03,2.32,.31,.10,.012,'#dde3e2')
  return finishModel(p,.34,.24)
}
