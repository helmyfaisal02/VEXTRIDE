/**
 * Integration check of buildings and props in the real physics world, headless:
 * <CityColliders>, <EnvColliders> and <Player>. Verifies building collision from
 * every side, reachable entrances, open roads, clear spawn and walkable
 * sidewalks. Run with `bun run verify:environment-physics`.
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
const { FIXED_DT, SPAWN_POSITION, FEET_OFFSET } = await import('../src/game/character/config')
const { playerState } = await import('../src/game/character/playerState')
const { resetInput } = await import('../src/game/input/inputState')
const { useCharacterStore } = await import('../src/game/state/characterStore')
const { CityColliders, CITY, SIDEWALK_TOP } = await import('../src/game/city')
const { EnvColliders, ENVIRONMENT, BUILDING_INFO } = await import('../src/game/environment')
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
        <EnvColliders />
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

const { Ray, QueryFilterFlags } = ctx.rapier
const flags = QueryFilterFlags.EXCLUDE_DYNAMIC
const cast = (ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, max: number) => ctx.world.castRay(new Ray({ x: ox, y: oy, z: oz }, { x: dx, y: dy, z: dz }), max, true, flags)
const inRect = (x: number, z: number, r: { minX: number; maxX: number; minZ: number; maxZ: number }, m = 0) => x > r.minX - m && x < r.maxX + m && z > r.minZ - m && z < r.maxZ + m
const BASE = SIDEWALK_TOP

await act(() => { useCharacterStore.getState().setName('Ace'); useCharacterStore.getState().confirm() })
run(240)

/* ------------------------------ spawn ------------------------------ */
{ const p = body.translation()
  check('spawn: rests on the plaza, not inside anything', Math.abs(p.y - (BASE + FEET_OFFSET)) < 0.015 && playerState.grounded, `y=${p.y.toFixed(3)}`)
  const dirs: Array<[string, string]> = [['KeyW', 'north'], ['KeyS', 'south'], ['KeyA', 'west'], ['KeyD', 'east']]
  for (const [key, name] of dirs) {
    place(SPAWN_POSITION[0], SPAWN_POSITION[2]); const a = body.translation(); press(key); run(90); press(key, false); run(30); const b = body.translation()
    check(`spawn: free to walk ${name} (moved ${Math.hypot(b.x - a.x, b.z - a.z).toFixed(1)} m in 1.5 s)`, Math.hypot(b.x - a.x, b.z - a.z) > 4.5)
  } }

/* --------------------- buildings: solid from every side -------------------- */
const colliderCount = ENVIRONMENT.colliders.length
{ let n = 0; ctx.world.forEachCollider((c) => { const t = c.translation(); if (Math.abs(t.x) < 171 && Math.abs(t.z) < 171) n++ })
  check('physics budget: all environment colliders share one body', n >= colliderCount && n < colliderCount + 70, `${n} colliders inside the city (${colliderCount} environment)`) }
for (const info of BUILDING_INFO) {
  const r = info.rect; const cx = (r.minX + r.maxX) / 2; const cz = (r.minZ + r.maxZ) / 2
  const top = cast(cx, 80, cz, 0, -1, 0, 100)
  const want = info.def.height + (info.def.type === 'office' ? 4 : info.def.type === 'house' ? 2.8 : info.def.type === 'warehouse' ? 2.2 : info.def.type === 'apartment' ? 3 : info.def.type === 'brick-commercial' ? 0.9 : info.def.type === 'workshop' ? 1.6 : info.def.type === 'convenience-store' ? 1.1 : 1)
  const topY = top ? 80 - top.timeOfImpact : -1
  // Rays from outside toward the centre at 1 m: each face is where the footprint says.
  const faces = [[r.minX - 1.2, 1, cz, 1, 0, 0, r.minX], [r.maxX + 1.2, 1, cz, -1, 0, 0, r.maxX], [cx, 1, r.minZ - 1.2, 0, 0, 1, r.minZ], [cx, 1, r.maxZ + 1.2, 0, 0, -1, r.maxZ]] as const
  let faceOk = true
  for (const [ox, oy, oz, dx, dy, dz, plane] of faces) { const h = cast(ox, oy, oz, dx, dy, dz, 40); if (!h) { faceOk = false; continue }; const hit = dx !== 0 ? ox + dx * h.timeOfImpact : oz + dz * h.timeOfImpact; if (Math.abs(hit - plane) > 0.02 && !info.solids.length) faceOk = false }
  check(`${info.def.id} ${info.def.type}: collider top ${topY.toFixed(1)} m and solid on all four sides`, Math.abs(topY - want) < 0.05 && faceOk)
}

/* --------------- walking up to each entrance (and into the wall) --------------- */
const KEY: Record<string, string> = { S: 'KeyW', N: 'KeyS', E: 'KeyA', W: 'KeyD' }
for (const info of BUILDING_INFO) {
  const { def, rect } = info
  const lot = CITY.blocks.find((b) => b.id === def.blockId)!.lot!
  const room = { S: lot.maxZ - rect.maxZ, N: rect.minZ - lot.minZ, E: lot.maxX - rect.maxX, W: rect.minX - lot.minX }[def.facing]
  const d = Math.min(8, room - 1)
  const f = { S: { x: def.x, z: rect.maxZ + d }, N: { x: def.x, z: rect.minZ - d }, E: { x: rect.maxX + d, z: def.z }, W: { x: rect.minX - d, z: def.z } }[def.facing]
  place(f.x, f.z); const startY = body.translation().y
  press(KEY[def.facing]); for (let i = 0; i < 400; i++) run(1); press(KEY[def.facing], false); run(30)
  const p = body.translation()
  const gap = def.facing === 'S' ? p.z - rect.maxZ : def.facing === 'N' ? rect.minZ - p.z : def.facing === 'E' ? p.x - rect.maxX : rect.minX - p.x
  const columns = def.type === 'showroom'
  check(`${def.id}: walk to the entrance from ${d.toFixed(0)} m away, stop at the wall (gap ${gap.toFixed(2)} m)`, !inRect(p.x, p.z, rect) && (columns ? gap < 4 : gap > 0.25 && gap < 0.45) && Math.abs(p.y - startY) < 0.02)
}

/* ------------------------------ open roads ------------------------------- */
{ let blocked = 0
  const lines = [-160, -80, 0, 80, 160]
  for (const l of lines) for (const off of [-3.5, 0, 3.5]) for (const y of [0.4, 1.0, 1.9]) {
    if (cast(-168, y, l + off, 1, 0, 0, 340) !== null) blocked++
    if (cast(l + off, y, -168, 0, 0, 1, 340) !== null) blocked++
  }
  check('no collider on any of the 10 road lines at 0.4 / 1.0 / 1.9 m height (every lane stays open)', blocked === 0, `${blocked} blocked rays`) }

/* ------------------------- walking the sidewalks --------------------------- */
const sidewalkRuns: Array<[string, number, number, number, string]> = [['downtown north sidewalk', -70, -151.3, -12, 'KeyD'], ['riverside south sidewalk', -70, 151.3, -12, 'KeyD'], ['residential east sidewalk', -86.4, -146, -12, 'KeyS']]
for (const [name, x0, z0, end, key] of sidewalkRuns) {
  if (key === 'KeyD') { place(x0, z0); press(key); press('ShiftLeft'); for (let i = 0; i < 1200 && body.translation().x < end - 2; i++) run(1); press(key, false); press('ShiftLeft', false) }
  else { place(x0, z0); press(key); press('ShiftLeft'); for (let i = 0; i < 1200 && body.translation().z < end - 2; i++) run(1); press(key, false); press('ShiftLeft', false) }
  run(20); const p = body.translation()
  const reached = key === 'KeyD' ? p.x >= end - 4 : p.z >= end - 4
  check(`${name}: sprint along it past lamps, trees and benches without being blocked`, reached && Math.abs(p.y - (BASE + FEET_OFFSET)) < 0.02, `x=${p.x.toFixed(1)} z=${p.z.toFixed(1)}`)
}

/* ---------------------- props that must stop the player ------------------------- */
const solidProps: Array<[string, (p: (typeof ENVIRONMENT.props)[number]) => boolean]> = [['tree trunk', (p) => p.kind === 'tree-round'], ['bench', (p) => p.kind === 'bench'], ['container', (p) => p.kind === 'container'], ['street lamp', (p) => p.kind === 'streetlight'], ['planter', (p) => p.kind === 'planter']]
for (const [name, pick] of solidProps) {
  const p = ENVIRONMENT.props.find(pick)!
  const x = p.x - 6, z = p.z
  place(x, z); press('KeyD'); run(240); press('KeyD', false); run(20)
  const b = body.translation()
  check(`${name}: walking straight into it stops the player (${p.id})`, b.x < p.x + 0.2 && Math.abs(b.y - body.translation().y) < 1)
}

await act(() => root.unmount())
console.log(fails === 0 ? 'ALL PASS' : `${fails} FAILED`)
process.exit(fails ? 1 : 0)
