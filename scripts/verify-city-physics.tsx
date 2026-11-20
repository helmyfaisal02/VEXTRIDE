/**
 * Integration check of the city's physics, headless: the real <CityColliders>
 * and <Player> in a real Rapier world. Verifies collider/visual alignment,
 * the absence of holes, a safe spawn, walking road <-> curb <-> sidewalk, and
 * sprinting across intersections without seams. Run with `bun run verify:city-physics`.
 */
import { Suspense, useEffect } from 'react'
import { advance, act as rawAct, createRoot, extend } from '@react-three/fiber'
import * as THREE from 'three'
import { CuboidCollider, Physics, RigidBody, useRapier } from '@react-three/rapier'

const act = rawAct as unknown as (callback: () => void | Promise<void>) => Promise<void>
extend(THREE)
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

class FakeElement { tagName = 'DIV'; isContentEditable = false }
const windowTarget = new EventTarget()
const store = new Map<string, string>()
Object.assign(windowTarget, { navigator: { userAgent: 'headless' }, innerWidth: 1280, innerHeight: 720, localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) } })
Object.assign(globalThis, { HTMLElement: FakeElement, window: windowTarget, document: Object.assign(new EventTarget(), { hidden: false }) })

const { Player } = await import('../src/game/character')
const { FIXED_DT, SPAWN_POSITION, FEET_OFFSET, STEP } = await import('../src/game/character/config')
const { playerState } = await import('../src/game/character/playerState')
const { resetInput } = await import('../src/game/input/inputState')
const { useCharacterStore } = await import('../src/game/state/characterStore')
const { CityColliders, CITY, ROAD_TOP, SIDEWALK_TOP, CURB_HEIGHT, DEMO_YARD_ORIGIN } = await import('../src/game/city')
const { Props } = await import('../src/game/world/Props')
const { surfaceHeightAt } = await import('../src/game/city/citySurface')

let fails = 0
const check = (name: string, ok: boolean, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${info}`); if (!ok) fails++ }

type Ctx = ReturnType<typeof useRapier>
let rapier: Ctx | null = null
function Capture() { const c = useRapier(); useEffect(() => { rapier = c }); return null }

const noop = () => {}
const canvas = { style: {}, ownerDocument: { addEventListener: noop, removeEventListener: noop }, width: 800, height: 600, clientWidth: 800, clientHeight: 600, addEventListener: noop, removeEventListener: noop, getContext: () => null } as unknown as HTMLCanvasElement
const renderer = { domElement: canvas, render: noop, setSize: noop, setPixelRatio: noop, setClearColor: noop, dispose: noop, forceContextLoss: noop, shadowMap: {}, info: {}, xr: { addEventListener: noop, removeEventListener: noop, setAnimationLoop: noop }, setAnimationLoop: noop, getContext: () => ({}) }
const root = createRoot(canvas)
root.configure({ gl: renderer as never, frameloop: 'never', size: { width: 800, height: 600, top: 0, left: 0 } })
await act(async () => {
  root.render(
    <Suspense fallback={null}>
      <Physics gravity={[0, -9.81, 0]} timeStep={FIXED_DT} updatePriority={-50}>
        <RigidBody type="fixed" colliders={false}><CuboidCollider args={[800, 0.5, 800]} position={[0, -0.5, 0]} /></RigidBody>
        <CityColliders />
        <group position={[DEMO_YARD_ORIGIN.x, 0, DEMO_YARD_ORIGIN.z]}><Props /></group>
        <Player />
        <Capture />
      </Physics>
    </Suspense>,
  )
  await new Promise((r) => setTimeout(r, 400))
})
for (let i = 0; i < 20 && !rapier; i++) await act(async () => { await new Promise((r) => setTimeout(r, 100)) })
const ctx = rapier as Ctx | null
if (!ctx) { console.log('FAIL  physics world did not start'); process.exit(1) }

let frame = 0
const run = (n: number) => { for (let i = 0; i < n; i++) { frame++; advance(frame * FIXED_DT) } }
type Body = { handle: number; translation(): { x: number; y: number; z: number }; setTranslation(v: { x: number; y: number; z: number }, w: boolean): void }
const player = () => { let b: unknown = null; ctx.world.forEachRigidBody((x) => { if (x.isDynamic()) b = x }); return b as Body }
const body = player()
const press = (code: string, down = true) => {
  const e = new Event(down ? 'keydown' : 'keyup')
  Object.defineProperties(e, { code: { value: code }, repeat: { value: false }, target: { value: null }, metaKey: { value: false }, preventDefault: { value: noop } })
  windowTarget.dispatchEvent(e)
}
const place = (x: number, z: number) => { resetInput(); body.setTranslation({ x, y: surfaceHeightAt(x, z) + FEET_OFFSET + 0.05, z }, true); run(60) }
const REST = (x: number, z: number) => surfaceHeightAt(x, z) + FEET_OFFSET

/* --------------------------- spawn and its safety --------------------------- */
await act(() => { useCharacterStore.getState().setName('Ace'); useCharacterStore.getState().confirm() })
run(240)
const sp = body.translation()
check('spawn: lands on the Central Plaza pavement and rests there', Math.abs(sp.y - (SIDEWALK_TOP + FEET_OFFSET)) < 0.015 && playerState.grounded, `y=${sp.y.toFixed(3)} (want ${(SIDEWALK_TOP + FEET_OFFSET).toFixed(3)})`)
check('spawn: stays where it spawned (no sliding off curbs)', Math.hypot(sp.x - SPAWN_POSITION[0], sp.z - SPAWN_POSITION[2]) < 0.05)
check('spawn: in the plaza, far from every curb', surfaceHeightAt(sp.x, sp.z) === SIDEWALK_TOP)

/* ----------------------------- colliders vs visuals ------------------------- */
let colliders = 0; ctx.world.forEachCollider((c) => { const t = c.translation(); if (Math.abs(t.x) < 800 && Math.abs(t.x) <= 171 && Math.abs(t.z) <= 171) colliders++ })
let bodies = 0; ctx.world.forEachRigidBody((b) => { const t = b.translation(); if (Math.abs(t.x) <= 171 && Math.abs(t.z) <= 171) bodies++ })
check('few physics objects inside the city: 3 bodies (ground, city, player) and about 60 colliders', bodies === 3 && colliders < 70, `${bodies} bodies, ${colliders} colliders`)
const { Ray } = ctx.rapier
const ray = new Ray({ x: 0, y: 5, z: 0 }, { x: 0, y: -1, z: 0 })
const flags = ctx.rapier.QueryFilterFlags.EXCLUDE_DYNAMIC
let holes = 0, wrong = 0, worst = 0, n = 0
for (let x = -169.3; x <= 169.3; x += 2.9) for (let z = -169.3; z <= 169.3; z += 2.9) {
  ray.origin.x = x; ray.origin.z = z
  const hit = ctx.world.castRay(ray, 10, true, flags)
  n++
  if (!hit) { holes++; continue }
  const err = Math.abs(5 - hit.timeOfImpact - surfaceHeightAt(x, z))
  worst = Math.max(worst, err); if (err > 1e-5) wrong++
}
check('no holes: every point of the city floor has a collider under it', holes === 0, `${n} rays`)
check('collider surface height equals the visible surface height everywhere', wrong === 0, `max error ${worst.toExponential(1)} m`)
check('no invisible barriers: nothing stands above the visible surface (ray from the side at 1 m)', (() => {
  const side = new Ray({ x: -169, y: 1, z: 0 }, { x: 1, y: 0, z: 0 })
  // Horizontal rays at head height along several roads should hit nothing across the city.
  return [0, -80, 80, -160, 160].every((z) => { side.origin.z = z; return ctx.world.castRay(side, 400, true, flags) === null })
})())

// The Phase 1 props still work where they were moved to (demo yard), at the same relative spots.
{ const r = new Ray({ x: DEMO_YARD_ORIGIN.x + 12, y: 60, z: DEMO_YARD_ORIGIN.z - 14 }, { x: 0, y: -1, z: 0 })
  const tower = ctx.world.castRay(r, 100, true, flags)
  check('demo yard: the 30 m teal tower collider is where it was, shifted into the yard', !!tower && Math.abs(60 - tower.timeOfImpact - 30) < 0.01, `top at y=${tower ? (60 - tower.timeOfImpact).toFixed(2) : 'none'}`)
  r.origin.x = 12; r.origin.z = -14
  const none = ctx.world.castRay(r, 100, true, flags)
  check('and nothing is left standing at the old position inside the city', !none || 60 - none.timeOfImpact < 0.2) }

/* ------------------------------ walking the streets ------------------------- */
const track = (frames: number, key: string) => {
  press(key); let maxJump = 0, prev = body.translation().y, minY = Infinity, maxY = -Infinity, maxVy = 0
  for (let i = 0; i < frames; i++) { run(1); const y = body.translation().y; maxJump = Math.max(maxJump, Math.abs(y - prev)); prev = y; minY = Math.min(minY, y); maxY = Math.max(maxY, y); maxVy = Math.max(maxVy, Math.abs((body as unknown as { linvel(): { y: number } }).linvel().y)) }
  press(key, false); run(40)
  return { maxJump, minY, maxY, maxVy, p: body.translation() }
}
{ // Road -> plaza curb (walk east across the secondary road at x=-80 into the plaza block).
  place(-82, -40); press('KeyD'); let steps = 0; const y0 = body.translation().y
  for (let i = 0; i < 200 && body.translation().x < -72; i++) { run(1); steps++ }
  press('KeyD', false); run(40)
  const p = body.translation()
  check('road -> plaza curb: walked up without jumping', p.x > -74 && Math.abs(p.y - REST(p.x, p.z)) < 0.015 && p.y - y0 > CURB_HEIGHT - 0.02, `y ${y0.toFixed(3)} -> ${p.y.toFixed(3)} after ${steps} steps`) }
{ // Road -> sidewalk -> lot (walk west from the road, over the curb, across the sidewalk, down into the lot).
  place(-80, -40); const r = track(200, 'KeyA'); const p = r.p
  check('road -> curb -> sidewalk -> lot (walk west): ends in the lot, 0.13 m curbs climbed and descended', surfaceHeightAt(p.x, p.z) === ROAD_TOP && Math.abs(p.y - REST(p.x, p.z)) < 0.015 && r.maxY > SIDEWALK_TOP + FEET_OFFSET - 0.02, `x=${p.x.toFixed(1)} peak y=${r.maxY.toFixed(3)}`)
  check('  the sidewalk crossing never launches the character (vertical speed capped)', r.maxVy < STEP.climbSpeed + 2, `peak vertical speed ${r.maxVy.toFixed(2)} m/s`) }
{ place(-80, -40); const r = track(120, 'KeyA'); void r
  place(-80, -40); press('ShiftLeft'); const s = track(100, 'KeyA'); press('ShiftLeft', false)
  check('sprinting over the curb works too', s.maxVy < STEP.climbSpeed + 2 && Math.abs(s.p.y - REST(s.p.x, s.p.z)) < 0.015, `end y=${s.p.y.toFixed(3)} x=${s.p.x.toFixed(1)}`) }
{ // Sprint through the central four-way and along a whole main road: no seams, no falls.
  place(-150, 0); press('ShiftLeft'); const r = track(2400, 'KeyD'); press('ShiftLeft', false)
  check('sprint along the main avenue through 5 junctions (x = -150 to +150): flat, no seams', r.maxJump < 0.01 && Math.abs(r.minY - r.maxY) < 0.02 && r.p.x > 120, `max step ${r.maxJump.toFixed(4)} m, x=${r.p.x.toFixed(0)}`) }
{ // Along a north-south secondary road and across crossings.
  place(-80, -150); press('ShiftLeft'); const r = track(2400, 'KeyS'); press('ShiftLeft', false)
  check('sprint along a secondary road end to end (z = -150 to +150): no seams', r.maxJump < 0.01 && r.p.z > 120, `max step ${r.maxJump.toFixed(4)} m, z=${r.p.z.toFixed(0)}`) }
{ // Diagonal across an intersection corner.
  place(-10, -10); press('KeyD'); press('KeyW'); press('ShiftLeft'); let maxJump = 0; let prev = body.translation().y
  for (let i = 0; i < 100; i++) { run(1); maxJump = Math.max(maxJump, Math.abs(body.translation().y - prev)); prev = body.translation().y }
  press('KeyD', false); press('KeyW', false); press('ShiftLeft', false); run(40)
  check('diagonal sprint across the central intersection corner is stable', maxJump < 0.1, `max step ${maxJump.toFixed(3)} m`) }
{ // Jumping onto the plaza from the street and landing on sidewalks.
  place(-82, -40); press('KeyD'); run(10); press('Space'); run(30); press('Space', false); run(60); press('KeyD', false); run(60)
  const p = body.translation(); check('jump from road onto the plaza lands cleanly', Math.abs(p.y - REST(p.x, p.z)) < 0.015 && playerState.grounded, `y=${p.y.toFixed(3)}`) }
{ // Every curb is within the step limit.
  check('every curb step is within the step-up limit', CURB_HEIGHT + 0.0 <= STEP.maxHeight && SIDEWALK_TOP <= STEP.maxHeight) }
{ // Recovery: falling out of the world returns the character to the plaza.
  place(0, 0); body.setTranslation({ x: 0, y: -60, z: 0 }, true); run(5)
  const p = body.translation(); run(180); const q = body.translation()
  check('character recovery respawns on the plaza and settles', Math.hypot(p.x - SPAWN_POSITION[0], p.z - SPAWN_POSITION[2]) < 0.5 && Math.abs(q.y - (SIDEWALK_TOP + FEET_OFFSET)) < 0.015, `y=${q.y.toFixed(3)}`) }
void CITY

await act(() => root.unmount())
console.log(fails === 0 ? 'ALL PASS' : `${fails} FAILED`)
process.exit(fails ? 1 : 0)
