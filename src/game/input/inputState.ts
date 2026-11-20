/**
 * Mutable input snapshot read by the simulation each fixed step. It lives
 * outside React on purpose: key presses must never trigger a re-render.
 */
export interface InputState {
  forward: boolean
  backward: boolean
  left: boolean
  right: boolean
  sprint: boolean
  /** Held state of the jump key (used to ignore key auto-repeat). */
  jumpHeld: boolean
  /** Set on a fresh jump press; consumed (cleared) by the controller. */
  jumpQueued: boolean
  recoveryHeld: boolean
  interactHeld: boolean
  interactQueued: boolean
}

export const inputState: InputState = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  sprint: false,
  jumpHeld: false,
  jumpQueued: false,
  recoveryHeld: false,
  interactHeld: false,
  interactQueued: false,
}

export function resetInput(): void {
  inputState.recoveryHeld = false
  inputState.forward = false
  inputState.backward = false
  inputState.left = false
  inputState.right = false
  inputState.sprint = false
  inputState.jumpHeld = false
  inputState.jumpQueued = false
  inputState.interactHeld = false
  inputState.interactQueued = false
}
