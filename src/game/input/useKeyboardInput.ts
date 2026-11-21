import { useEffect } from 'react'
import { isTypingTarget } from '../shared/dom'
import { useCharacterStore } from '../state/characterStore'
import { useGarageStore } from '../garage/garageState'
import { useDialogueStore } from '../interactions/dialogueState'
import { inputState, resetInput } from './inputState'

/** Keys whose default browser behaviour (page scroll) must be suppressed in play. */
const BLOCKED_DEFAULTS = new Set([
  'Space',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
])

function setKey(code: string, down: boolean): void {
  switch (code) {
    case 'KeyR':
      inputState.recoveryHeld = down
      break
    case 'KeyE':
      if (down && !inputState.interactHeld) inputState.interactQueued = true
      inputState.interactHeld = down
      break
    case 'KeyW':
    case 'ArrowUp':
      inputState.forward = down
      break
    case 'KeyS':
    case 'ArrowDown':
      inputState.backward = down
      break
    case 'KeyA':
    case 'ArrowLeft':
      inputState.left = down
      break
    case 'KeyD':
    case 'ArrowRight':
      inputState.right = down
      break
    case 'ShiftLeft':
    case 'ShiftRight':
      inputState.sprint = down
      break
    case 'Space':
      if (down && !inputState.jumpHeld) inputState.jumpQueued = true
      inputState.jumpHeld = down
      break
  }
}

/**
 * Installs one keydown/keyup pair (plus blur handling) for as long as the
 * calling component is mounted. Writes to `inputState`; never sets React state.
 */
export function useKeyboardInput(): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // The character creator owns the keyboard while it is open.
      if (useCharacterStore.getState().menuOpen) return
      const dialogue=useDialogueStore.getState()
      if(dialogue.active){
        if(e.code==='Escape'&&!e.repeat){e.preventDefault();dialogue.close()}
        return
      }
      const garage=useGarageStore.getState()
      if(garage.open){if(e.code==='Escape'&&!e.repeat){e.preventDefault();garage.close()};return}
      if (isTypingTarget(e.target)) return
      if ((e.code === 'KeyE' || e.code === 'KeyR') && (e.ctrlKey || e.altKey)) return
      // With Cmd held the browser swallows other keys' keyup events, which
      // would leave movement keys stuck; treat it as leaving the game keys.
      if (e.metaKey) {
        resetInput()
        return
      }
      if (BLOCKED_DEFAULTS.has(e.code)) e.preventDefault()
      // Held flags already carry continuous input. A reset (mode/menu/focus)
      // must require a fresh press, rather than reactivating on OS repeat.
      if (e.repeat) return
      setKey(e.code, true)
    }
    const onKeyUp = (e: KeyboardEvent) => {
      setKey(e.code, false)
    }
    const onBlur = () => resetInput()
    const onVisibility = () => {
      if (document.hidden) resetInput()
    }

    // Drop held keys the moment the creator opens so the player stops cleanly.
    const unsubscribe = useCharacterStore.subscribe((state, prev) => {
      if (state.menuOpen && !prev.menuOpen) resetInput()
    })

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      unsubscribe()
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('visibilitychange', onVisibility)
      resetInput()
    }
  }, [])
}
