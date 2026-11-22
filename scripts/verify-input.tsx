/**
 * Verifies keyboard input gating: gameplay keys are ignored while the character
 * creator is open or a text field has focus, Space is only blocked from
 * scrolling during play, and held keys are released when the creator opens.
 * Runs the real `useKeyboardInput` hook in a headless R3F root with stub
 * window/document objects. Run with `bun run verify:input`.
 */
import { createElement } from 'react'
import { act as rawAct, createRoot } from '@react-three/fiber'

const act = rawAct as unknown as (callback: () => void | Promise<void>) => Promise<void>
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

/* Minimal browser stand-ins: just enough for the hook. */
class FakeElement {
  tagName: string
  isContentEditable = false
  blurred = false
  constructor(tagName: string) { this.tagName = tagName }
  blur() { this.blurred = true }
}
const windowTarget = new EventTarget()
const documentTarget = Object.assign(new EventTarget(), { hidden: false })
Object.assign(globalThis, { HTMLElement: FakeElement, window: windowTarget, document: documentTarget })

const fakeStorage = new Map<string, string>()
Object.assign(windowTarget, {
  localStorage: { getItem: (k: string) => fakeStorage.get(k) ?? null, setItem: (k: string, v: string) => void fakeStorage.set(k, v) },
})

const { useKeyboardInput } = await import('../src/game/input')
const { inputState } = await import('../src/game/input/inputState')
const { useCharacterStore } = await import('../src/game/state/characterStore')

let fails = 0
const check = (name: string, ok: boolean, info = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${info}`)
  if (!ok) fails++
}

function key(type: 'keydown' | 'keyup', code: string, target: unknown = null, extra: Record<string, unknown> = {}): { prevented: boolean } {
  const result = { prevented: false }
  const event = new Event(type)
  Object.defineProperties(event, {
    code: { value: code },
    repeat: { value: extra.repeat === true },
    defaultPrevented: { value: extra.defaultPrevented === true },
    target: { value: target },
    metaKey: { value: extra.metaKey === true },
    preventDefault: { value: () => { result.prevented = true } },
  })
  windowTarget.dispatchEvent(event)
  return result
}

function Probe() {
  useKeyboardInput()
  return null
}

const canvas = { style: {}, addEventListener() {}, removeEventListener() {}, getContext: () => null } as unknown as HTMLCanvasElement
const root = createRoot(canvas)
root.configure({ gl: { domElement: canvas, render() {}, setSize() {}, setPixelRatio() {}, dispose() {}, shadowMap: {}, info: {}, xr: { addEventListener() {}, removeEventListener() {}, setAnimationLoop() {} }, setAnimationLoop() {}, getContext: () => ({}) } as never, frameloop: 'never', size: { width: 1, height: 1, top: 0, left: 0 } })
await act(() => { root.render(createElement(Probe)) })

const st = () => useCharacterStore.getState()
check('first launch: creator is open', st().menuOpen)

key('keydown', 'KeyW')
check('creator open: W is ignored', !inputState.forward)
const space = key('keydown', 'Space')
check('creator open: Space is not hijacked (page/inputs keep default behaviour)', !space.prevented && !inputState.jumpQueued)

// Confirm a character to close the creator.
st().setName('Ace')
check('confirm closes the creator', st().confirm() && !st().menuOpen)

key('keydown', 'KeyW'); key('keydown', 'ShiftLeft'); key('keydown', 'KeyD')
check('gameplay: WASD + Shift register', inputState.forward && inputState.sprint && inputState.right)
const jump = key('keydown', 'Space')
check('gameplay: Space queues a jump and blocks page scroll', inputState.jumpQueued && jump.prevented)
const arrow = key('keydown', 'ArrowDown')
check('gameplay: arrow keys blocked from scrolling', arrow.prevented && inputState.backward)

st().openMenu()
check('opening the creator releases every held key', !inputState.forward && !inputState.sprint && !inputState.right && !inputState.backward && !inputState.jumpQueued && !inputState.jumpHeld)
key('keydown', 'KeyA')
check('creator reopened: A ignored', !inputState.left)
st().cancel()

key('keyup', 'KeyA')
const input = new FakeElement('INPUT')
key('keydown', 'KeyW', input)
check('typing in a text field: W is ignored', !inputState.forward)
const typedSpace = key('keydown', 'Space', input)
check('typing in a text field: Space is not hijacked', !typedSpace.prevented)
key('keydown', 'KeyW', new FakeElement('DIV'))
check('focus on a non-text element still plays', inputState.forward)
key('keyup', 'KeyW')

const hudButton = new FakeElement('BUTTON')
const hudSpace = key('keydown', 'Space', hudButton)
check('Space activates a focused HUD button without queuing a gameplay jump', !hudSpace.prevented && !inputState.jumpQueued)
key('keydown', 'KeyW', hudButton)
check('a movement key moves focus out of a HUD button and resumes gameplay', hudButton.blurred && inputState.forward)
key('keyup', 'KeyW')
key('keydown', 'KeyD', hudButton, { defaultPrevented: true })
check('keyboard events consumed by UI do not queue gameplay input', !inputState.right)

// Opening and closing the creator while a key is held never leaves it stuck.
key('keydown', 'KeyW')
st().openMenu(); st().cancel()
check('hold W, open then close the creator: W is not stuck', !inputState.forward)
key('keyup', 'KeyW')
key('keydown', 'KeyW')
check('movement responds again right after the creator closes', inputState.forward)
key('keyup', 'KeyW')
key('keydown', 'KeyD'); key('keydown', 'ShiftLeft')
st().openMenu(); key('keyup', 'KeyD'); key('keyup', 'ShiftLeft'); st().cancel()
check('keys released while the creator was open stay released', !inputState.right && !inputState.sprint)
key('keydown', 'KeyW'); key('keydown', 'KeyA')
key('keydown', 'KeyS', null, { metaKey: true })
check('Cmd held (browser swallows keyups): all keys are released, nothing sticks', !inputState.forward && !inputState.left && !inputState.backward)

windowTarget.dispatchEvent(new Event('keydown'))
Object.assign(documentTarget, { hidden: true })
inputState.forward = true
documentTarget.dispatchEvent(new Event('visibilitychange'))
check('hiding the tab releases held keys', !inputState.forward)
inputState.right = true
windowTarget.dispatchEvent(new Event('blur'))
check('window blur releases held keys', !inputState.right)

// R shares the existing input listener and all focus/menu/typing guards.
Object.assign(documentTarget, { hidden: false })
key('keydown', 'KeyR', input)
check('typing ignores recovery R', !inputState.recoveryHeld)
key('keydown', 'KeyR')
check('fresh R press is held for fixed-step recovery', inputState.recoveryHeld)
windowTarget.dispatchEvent(new Event('blur'))
key('keydown', 'KeyR', null, { repeat: true })
check('blur resets R and OS repeat cannot re-arm recovery', !inputState.recoveryHeld)
key('keyup', 'KeyR'); key('keydown', 'KeyR')
st().openMenu()
check('creator opening resets held R', !inputState.recoveryHeld)
key('keydown', 'KeyR')
check('creator ignores recovery R', !inputState.recoveryHeld)
st().cancel()
key('keydown', 'KeyR')
Object.assign(documentTarget, { hidden: true })
documentTarget.dispatchEvent(new Event('visibilitychange'))
check('tab hiding resets recovery hold', !inputState.recoveryHeld)
key('keyup', 'KeyR')

await act(() => root.unmount())
key('keydown', 'KeyW')
check('listeners are removed on unmount', !inputState.forward)

console.log(fails === 0 ? 'ALL PASS' : `${fails} FAILED`)
process.exit(fails ? 1 : 0)
