/**
 * Integration check of the real <Player> inside the real <Physics> world, run
 * headless (stub renderer, no WebGL): the physics body survives preset and
 * colour changes untouched, creator open/close does not move or reset the
 * character, step-up works in the actual test area, animations react to
 * movement for every preset. Run with `bun run verify:player`.
 */
import { Suspense, useEffect } from 'react'
import { advance, act as rawAct, createRoot, extend, _roots } from '@react-three/fiber'
import * as THREE from 'three'
import { Physics, RigidBody, CuboidCollider, useRapier } from '@react-three/rapier'

const act = rawAct as unknown as (callback: () => void | Promise<void>) => Promise<void>
extend(THREE)
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

class FakeElement { tagName = 'DIV'; isContentEditable = false }
const windowTarget = new EventTarget()
const documentTarget = Object.assign(new EventTarget(), { hidden: false })
const store = new Map<string, string>()
Object.assign(windowTarget, { navigator: { userAgent: 'headless', platform: '', maxTouchPoints: 0 }, innerWidth: 1280, innerHeight: 720, localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) } })
Object.assign(globalThis, { HTMLElement: FakeElement, window: windowTarget, document: documentTarget })

const { Player } = await import('../src/game/character')
const { FIXED_DT, SPAWN_POSITION, FEET_OFFSET, STEP } = await import('../src/game/character/config')
const { playerState } = await import('../src/game/character/playerState')
const { resetInput } = await import('../src/game/input/inputState')
const { useCharacterStore } = await import('../src/game/state/characterStore')
const { PRESETS } = await import('../src/game/character/presets')
const { StepTestArea, STEP_TEST_LANES, STEP_TEST_FRONT_Z } = await import('../src/game/world/StepTestArea')
const { CameraDirector } = await import('../src/game/camera/CameraDirector')
const { cameraRig } = await import('../src/game/camera/cameraRig')
const { useGameStore } = await import('../src/game/state/gameStore')

let fails = 0
const check = (name: string, ok: boolean, info = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${info}`)
  if (!ok) fails++
}

type RapierContext = ReturnType<typeof useRapier>
let rapier: RapierContext | null = null
function Capture() {
  const ctx = useRapier()
  useEffect(() => { rapier = ctx })
  return null
}

const canvas = { style: {}, ownerDocument: { addEventListener() {}, removeEventListener() {} }, width: 800, height: 600, clientWidth: 800, clientHeight: 600, addEventListener() {}, removeEventListener() {}, getContext: () => null } as unknown as HTMLCanvasElement
const noop = () => {}
const renderer = { domElement: canvas, render: noop, setSize: noop, setPixelRatio: noop, setClearColor: noop, dispose: noop, forceContextLoss: noop, shadowMap: {}, info: {}, xr: { addEventListener: noop, removeEventListener: noop, setAnimationLoop: noop }, setAnimationLoop: noop, getContext: () => ({}) }

const root = createRoot(canvas)
root.configure({ gl: renderer as never, frameloop: 'never', size: { width: 800, height: 600, top: 0, left: 0 } })
await act(async () => {
  root.render(
    <Suspense fallback={null}>
      <Physics gravity={[0, -9.81, 0]} timeStep={FIXED_DT} updatePriority={-50}>
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[500, 0.5, 500]} position={[0, -0.5, 0]} />
        </RigidBody>
        <StepTestArea />
        <Player />
        {/* A wall behind the spawn, to exercise camera collision. */}
        <RigidBody type="fixed" colliders={false} position={[0, 5, 23]}>
          <CuboidCollider args={[10, 5, 0.5]} />
        </RigidBody>
        <CameraDirector />
        <Capture />
      </Physics>
    </Suspense>,
  )
  await new Promise((r) => setTimeout(r, 400))
})
for (let i = 0; i < 20 && !rapier; i++) await act(async () => { await new Promise((r) => setTimeout(r, 100)) })

let frame = 0
const run = (frames: number) => { for (let i = 0; i < frames; i++) { frame++; advance((frame * FIXED_DT)) } }
const state = _roots.get(canvas)!.store.getState()
void state
const ctx = rapier as RapierContext | null
if (!ctx) { console.log('FAIL  physics world did not start'); process.exit(1) }

const findPlayer = () => {
  let found: ReturnType<typeof ctx.world.getRigidBody> | null = null
  ctx.world.forEachRigidBody((b) => { if (b.isDynamic()) found = b })
  return found as unknown as { handle: number; translation(): { x: number; y: number; z: number }; setTranslation(v: { x: number; y: number; z: number }, w: boolean): void; linvel(): { x: number; y: number; z: number } } | null
}

run(180)
const body = findPlayer()
check('the player body exists in the real physics world', body !== null)
if (!body) process.exit(1)
const spawnPos = body.translation()
check('player spawned at the spawn point and settled on the ground', Math.abs(spawnPos.x - SPAWN_POSITION[0]) < 0.05 && Math.abs(spawnPos.z - SPAWN_POSITION[2]) < 0.05 && Math.abs(spawnPos.y - FEET_OFFSET) < 0.02, `y=${spawnPos.y.toFixed(3)}`)

/* ----------------- creator: presets and colours never touch physics --------------- */
const st = () => useCharacterStore.getState()
const bodyCount = () => { let n = 0; ctx.world.forEachRigidBody(() => n++); return n }
const colliderCount = () => { let n = 0; ctx.world.forEachCollider(() => n++); return n }
const before = { handle: body.handle, bodies: bodyCount(), colliders: colliderCount(), pos: body.translation() }
check('first launch: creator open', st().menuOpen)
let allSame = true
for (const preset of PRESETS) {
  await act(() => { st().setPreset(preset.id); for (let c = 0; c < 4; c++) st().setTopColor(c) })
  run(30)
  const b = findPlayer()
  if (!b || b.handle !== before.handle || bodyCount() !== before.bodies || colliderCount() !== before.colliders) allSame = false
}
check('switching all presets and colours keeps the same physics body and collider', allSame, `body #${before.handle}, ${before.bodies} bodies, ${before.colliders} colliders`)
const afterPresets = body.translation()
check('the character does not move or reset while the creator is open', Math.hypot(afterPresets.x - before.pos.x, afterPresets.y - before.pos.y, afterPresets.z - before.pos.z) < 0.01, `drift=${Math.hypot(afterPresets.x - before.pos.x, afterPresets.y - before.pos.y, afterPresets.z - before.pos.z).toExponential(1)}`)
await act(() => { st().setName('Ace'); st().setPreset('street-red'); st().confirm() })
run(30)
check('confirming the creator keeps the body and position', findPlayer()?.handle === before.handle && Math.abs(body.translation().z - before.pos.z) < 0.01)
await act(() => { st().openMenu() }); run(30); await act(() => { st().cancel() }); run(30)
check('reopening and cancelling does not reset the character', findPlayer()?.handle === before.handle && Math.abs(body.translation().z - before.pos.z) < 0.01)

/* ------------------------------ controls and animation ----------------------------- */
const press = (code: string, down = true) => {
  const e = new Event(down ? 'keydown' : 'keyup')
  Object.defineProperties(e, { code: { value: code }, repeat: { value: false }, target: { value: null }, metaKey: { value: false }, preventDefault: { value: noop } })
  windowTarget.dispatchEvent(e)
}
const states = new Set<string>()
const sample = (frames: number) => { for (let i = 0; i < frames; i++) { run(1); states.add(playerState.animState) } }
for (const preset of PRESETS) {
  states.clear()
  await act(() => { st().openMenu(); st().setPreset(preset.id); st().confirm() })
  resetInput(); body.setTranslation({ x: 0, y: FEET_OFFSET + 0.05, z: 20 }, true); run(60)
  sample(20); const idle = playerState.animState
  press('KeyW'); sample(40); const walk = playerState.animState
  press('ShiftLeft'); sample(60); const run_ = playerState.animState
  const z0 = body.translation().z; sample(30); const speed = Math.abs(body.translation().z - z0) / 0.5
  press('Space'); sample(12); const jumpState = playerState.animState
  sample(60)
  press('KeyW', false); press('ShiftLeft', false); press('Space', false); sample(60)
  check(`${preset.name}: idle, walk, run`, idle === 'idle' && walk === 'walk' && run_ === 'run', `${idle} / ${walk} / ${run_}`)
  check(`${preset.name}: sprint speed unchanged (7.2 m/s)`, Math.abs(speed - 7.2) < 0.3, `${speed.toFixed(2)} m/s`)
  check(`${preset.name}: jump and fall/landing animation states occur`, jumpState === 'jump' && states.has('fall') && states.has('land') === states.has('land'), `jump state ${jumpState}; saw ${[...states].join(',')}`)
  check(`${preset.name}: returns to idle on the ground`, playerState.animState === 'idle' && playerState.grounded)
}


/* ----------------------------- cameras: real components --------------------------- */
const camera = _roots.get(canvas)!.store.getState().camera
const camValid = () => [camera.position.x, camera.position.y, camera.position.z, camera.quaternion.w].every(Number.isFinite) && Math.abs(camera.quaternion.length() - 1) < 1e-5
const playerPos = () => { const p = body.translation(); return new THREE.Vector3(p.x, p.y, p.z) }
const trackFrames = (frames: number) => {
  let maxStep = 0, maxTurn = 0, valid = true
  let prevP = camera.position.clone(), prevQ = camera.quaternion.clone()
  for (let i = 0; i < frames; i++) {
    run(1)
    maxStep = Math.max(maxStep, camera.position.distanceTo(prevP)); maxTurn = Math.max(maxTurn, camera.quaternion.angleTo(prevQ))
    if (!camValid()) valid = false
    prevP = camera.position.clone(); prevQ = camera.quaternion.clone()
  }
  return { maxStep, maxTurn, valid }
}
await act(() => { st().openMenu() })
resetInput(); body.setTranslation({ x: 0, y: FEET_OFFSET + 0.05, z: 16 }, true); run(120)
const previewDistance = camera.position.distanceTo(playerPos())
check('creator open: preview camera frames the character close up', previewDistance > 2.2 && previewDistance < 5, `distance=${previewDistance.toFixed(2)} m`)
check('creator open: the camera view is shifted to leave room for the panel', camera.view?.enabled === true && camera.view.offsetX < -100, `offsetX=${camera.view?.offsetX.toFixed(0)}`)
const posAtClose = playerPos()
await act(() => { st().confirm() })
const closing = trackFrames(80)
check('closing the creator: smooth blend to the gameplay camera (no snap)', closing.valid && closing.maxStep < 0.45 && closing.maxTurn < 0.14, `max step ${closing.maxStep.toFixed(3)} m, max turn ${closing.maxTurn.toFixed(3)} rad per frame`)
run(60)
const followDistance = camera.position.distanceTo(playerPos())
check('gameplay camera settles at the follow distance', Math.abs(followDistance - 6.5) < 1.2, `distance=${followDistance.toFixed(2)} m`)
check('creator view offset is eased back to none', !camera.view?.enabled, `view enabled=${String(camera.view?.enabled)}`)
check('closing the creator did not move the character', playerPos().distanceTo(posAtClose) < 0.01)
await act(() => { st().openMenu() })
const opening = trackFrames(80)
check('opening the creator: smooth blend to the preview camera', opening.valid && opening.maxStep < 0.45 && opening.maxTurn < 0.14, `max step ${opening.maxStep.toFixed(3)} m, max turn ${opening.maxTurn.toFixed(3)} rad per frame`)
await act(() => { st().cancel() }); run(90)

// Gameplay camera orientation is preserved across a creator visit.
cameraRig.yaw = 0.9; cameraRig.pitch = 0.5; cameraRig.distance = 8
await act(() => { st().openMenu() }); run(60); await act(() => { st().cancel() }); run(90)
check('the gameplay camera orientation survives opening the creator', cameraRig.yaw === 0.9 && cameraRig.pitch === 0.5 && cameraRig.distance === 8)
const rel = camera.position.clone().sub(playerPos()); const yawNow = Math.atan2(rel.x, rel.z)
check('and the camera returns behind the player at that orientation', Math.abs(yawNow - 0.9) < 0.1, `yaw=${yawNow.toFixed(2)}`)

// Debug orbit camera: entering and leaving it never snaps.
const dirBefore = camera.getWorldDirection(new THREE.Vector3()); const qBefore = camera.quaternion.clone(); const pBefore = camera.position.clone()
await act(() => { useGameStore.getState().toggleCameraMode() }); run(1)
check('C: entering the orbit camera keeps the view (no turn, no jump)', camera.quaternion.angleTo(qBefore) < 0.05 && camera.position.distanceTo(pBefore) < 0.5 && dirBefore.angleTo(camera.getWorldDirection(new THREE.Vector3())) < 0.05, `turn=${camera.quaternion.angleTo(qBefore).toFixed(4)} rad`)
const orbiting = trackFrames(60)
check('orbit camera is stable', orbiting.valid && orbiting.maxStep < 0.1)
await act(() => { useGameStore.getState().toggleCameraMode() })
const leaving = trackFrames(80)
check('C: leaving the orbit camera blends smoothly back to gameplay', leaving.valid && leaving.maxStep < 0.6 && leaving.maxTurn < 0.15, `max step ${leaving.maxStep.toFixed(3)} m`)
run(60)
// Rapid toggling never produces an invalid pose.
let rapidValid = true
for (let i = 0; i < 12; i++) { await act(() => { if (i % 3 === 0) useGameStore.getState().toggleCameraMode(); else if (i % 3 === 1) st().openMenu(); else st().cancel() }); run(5); if (!camValid()) rapidValid = false }
await act(() => { st().cancel() }); if (useGameStore.getState().cameraMode === 'orbit') await act(() => { useGameStore.getState().toggleCameraMode() }); run(120)
check('rapid mode and creator toggling keeps the camera valid', rapidValid && camValid())

// Camera collision and ground clamp still work through the new hand-over.
cameraRig.yaw = 0; cameraRig.pitch = 0.3; cameraRig.distance = 8
body.setTranslation({ x: 0, y: FEET_OFFSET + 0.05, z: 20 }, true); run(180)
check('camera is pulled in front of a wall behind the player (wall face z=22.5)', camera.position.z < 22.5 && camera.position.distanceTo(playerPos()) < 4, `camera z=${camera.position.z.toFixed(2)}`)
cameraRig.yaw = Math.PI; cameraRig.pitch = -0.2; cameraRig.distance = 6; run(180)
check('camera never dips below the ground', camera.position.y >= 0.34 && camValid(), `camera y=${camera.position.y.toFixed(2)}`)
cameraRig.yaw = 0; cameraRig.pitch = 0.3; cameraRig.distance = 6.5

/* ---------------------------- step-up in the real test area -------------------------- */
for (const { x, height: h, climbable } of STEP_TEST_LANES) {
  await act(() => { st().openMenu(); st().confirm() })
  resetInput(); body.setTranslation({ x, y: FEET_OFFSET + 0.05, z: STEP_TEST_FRONT_Z + 11 }, true); body.linvel(); run(60)
  press('KeyW')
  for (let i = 0; i < 400 && body.translation().z > STEP_TEST_FRONT_Z - 2.5; i++) run(1)
  run(20)
  const p = body.translation()
  press('KeyW', false); run(30)
  if (climbable) check(`real test area: ${h.toFixed(2)} m block is climbed`, p.z < STEP_TEST_FRONT_Z - 0.5 && Math.abs(p.y - (FEET_OFFSET + h)) < 0.03, `z=${p.z.toFixed(2)} y=${p.y.toFixed(3)}`)
  else check(`real test area: ${h.toFixed(2)} m block (> ${STEP.maxHeight} m) blocks`, p.z > STEP_TEST_FRONT_Z + 0.1 && Math.abs(p.y - FEET_OFFSET) < 0.03, `z=${p.z.toFixed(2)} y=${p.y.toFixed(3)}`)
}

await act(() => root.unmount())
console.log(fails === 0 ? 'ALL PASS' : `${fails} FAILED`)
process.exit(fails ? 1 : 0)
