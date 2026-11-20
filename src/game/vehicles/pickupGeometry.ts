import { modelParts,modelBox as box,belt,finishModel } from './modelPrimitives'

/** Original utility truck: high cab, square grille, separate open bed and tailgate. */
export function createPickupAssets() {
  const p=modelParts(),{body,glass,trim,head,tail}=p
  const paint='#c88a3f',black='#283039',window='#7c9ba6'
  belt(body,[[-2.55,.78,.23],[-2.2,.95,.32],[-1.18,.94,.37],[.45,.95,.30]],paint)
  box(body,0,-.10,-.1,1.84,.5,2.0,paint)
  box(body,0,-.15,-2.34,1.64,.44,.42,paint)
  box(body,0,1.115,-.325,1.49,.07,.95,paint)
  // Cab rear wall closes only the cab; the bed behind it remains open.
  box(body,0,.64,.38,1.69,.91,.10,paint)
  glass.quad([-.80,.37,-1.18],[.80,.37,-1.18],[.745,1.08,-.80],[-.745,1.08,-.80],[0,.7,-.7],window)
  glass.quad([.60,.64,.436],[-.60,.64,.436],[-.60,1.02,.436],[.60,1.02,.436],[0,0,1],window)
  for(const s of[-1,1]){
    glass.quad([s*.82,.37,-1.1],[s*.82,.37,.28],[s*.745,1.08,.10],[s*.745,1.08,-.75],[s,0,0],window)
    box(trim,s*.94,.22,-.08,.03,.055,.27,'#d7d9d4')
    box(trim,s*.96,.51,-.93,.08,.17,.22,black)
    box(trim,s*.91,-.32,-.1,.065,.05,1.95,black)
    // Painted rails and dark caps; no top spanning the bed opening.
    box(body,s*.91,.22,1.46,.18,.58,1.98,paint)
    box(trim,s*.91,.53,1.46,.19,.045,2.0,black)
    box(head,s*.63,.12,-2.555,.32,.22,.02,'#fff0c4')
    box(tail,s*.79,.26,2.555,.15,.30,.02,'#fa3342')
  }
  box(trim,0,-.09,1.45,1.66,.10,1.94,'#3e4549') // visible recessed cargo floor
  box(body,0,.20,2.49,1.80,.60,.12,paint)
  box(trim,0,.52,2.49,1.83,.045,.13,black)
  box(trim,0,.27,2.558,.34,.055,.02,'#d0d3cf') // tailgate latch
  box(trim,0,-.22,2.54,1.91,.12,.08,black)
  box(trim,0,.04,-2.559,.75,.32,.025,black)
  for(const y of[-.07,.04,.15])box(trim,0,y,-2.575,.70,.032,.02,'#aeb8b9')
  return finishModel(p,.39,.30)
}
