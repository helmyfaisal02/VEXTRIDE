import type { InputState } from '../input/inputState'

/** Direction is measured; S while reversing is throttle, W while reversing is braking. */
export function vehicleSignals(speed:number,input:InputState,occupied:boolean) {
  return {
    braking:occupied&&(input.jumpHeld||(input.backward&&speed>=-.15)||(input.forward&&speed<-.15)),
    reversing:occupied&&speed<-.15&&!input.jumpHeld,
  }
}
