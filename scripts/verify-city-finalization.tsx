/** Phase 2.4: actual city geometry, Rapier colliders and Player traversal. */
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
const { FIXED_DT, FEET_OFFSET } = await import('../src/game/character/config')
const { playerState } = await import('../src/game/character/playerState')
const { resetInput } = await import('../src/game/input/inputState')
const { useCharacterStore } = await import('../src/game/state/characterStore')
const { CityColliders, CITY, SIDEWALK_TOP } = await import('../src/game/city')
const { EnvColliders, ENVIRONMENT } = await import('../src/game/environment')
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
await act(() => { useCharacterStore.getState().setName('Ace'); useCharacterStore.getState().confirm() })
run(240)

const { DRIVEWAYS, buildDriveways, motorParking } = await import('../src/game/city/driveways')
const { buildCityGeometries } = await import('../src/game/city/cityGeometry')
const { ROAD_TOP } = await import('../src/game/city/cityConfig')
const { overlaps, propRect } = await import('../src/game/environment/propLayout')
const { buildEnvironmentGeometry } = await import('../src/game/environment/envGeometry')

check('four stable Motor Row entrances, tied to existing buildings and parking pads', DRIVEWAYS.length === 4 && JSON.stringify(DRIVEWAYS) === JSON.stringify(buildDriveways()) && DRIVEWAYS.every((d) => d.width >= 6 && CITY.blocks.find((b) => b.id === d.blockId)?.districtId === 'motor-row'))
const garage = DRIVEWAYS.find((d) => d.id === 'garage-bay')!
const garageBuilding = ENVIRONMENT.buildings.find((b) => b.id === garage.buildingId)!
check('garage approach aligns with its existing 5.2 m right roll-up bay', Math.abs(garage.center - (garageBuilding.x + garageBuilding.width * 0.05)) < 1e-6 && garage.width >= 5.2)
const pads = motorParking()
check('parking entrances connect to the existing aisle, with no parking stripe across the approach', DRIVEWAYS.filter((d) => d.parkingId).every((d) => {
  const pad = d.parkingId === 'north' ? pads.north : pads.south
  return overlaps(d.approach, pad) && !ENVIRONMENT.paint.some((p) => p.layer === 'lines' && overlaps(p.rect, d.approach))
}))

const geometry = buildCityGeometries()
const mesh = new THREE.Mesh(geometry.surface, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }))
mesh.updateMatrixWorld(true)
const raycaster = new THREE.Raycaster()
let holes = 0, mismatches = 0, maxError = 0
for (const cut of DRIVEWAYS) {
  const s = CITY.sidewalks.find((s) => s.id === cut.sidewalkId)!
  const road = CITY.roads.find((r) => r.id === cut.roadId)!
  const edge = cut.side === 'N' ? s.rect.minZ : s.rect.maxZ
  check(`${cut.id}: flush road/lot crossing with untouched sidewalk beyond shoulders`,
    Math.abs((cut.side === 'N' ? road.rect.maxZ : road.rect.minZ) - edge) < 1e-8 &&
    surfaceHeightAt(cut.center, edge) === ROAD_TOP &&
    surfaceHeightAt(cut.center - cut.width / 2 - cut.flare - 0.01, (s.rect.minZ + s.rect.maxZ) / 2) === SIDEWALK_TOP)
  let continuous = true, prev: number | null = null
  for (let x = cut.center - cut.width / 2 - cut.flare - 0.1; x < cut.center + cut.width / 2 + cut.flare + 0.1; x += 0.08) {
    for (let z = s.rect.minZ + 0.02; z < s.rect.maxZ; z += 0.16) {
      raycaster.set(new THREE.Vector3(x, 2, z), new THREE.Vector3(0, -1, 0))
      const visible = raycaster.intersectObject(mesh, false)[0]
      const physical = cast(x, 2, z, 0, -1, 0, 4)
      if (!visible || !physical) { holes++; continue }
      const error = Math.max(Math.abs(visible.point.y - (2 - physical.timeOfImpact)), Math.abs(visible.point.y - surfaceHeightAt(x, z)))
      maxError = Math.max(maxError, error)
      if (error > 0.00002) mismatches++
    }
    const h = surfaceHeightAt(x, (s.rect.minZ + s.rect.maxZ) / 2)
    if (prev !== null && Math.abs(h - prev) > 0.008) continuous = false
    prev = h
  }
  check(`${cut.id}: continuous pedestrian shoulders, slope <= 0.13 / 1.5`, continuous)
  const shoulderRect = { ...cut.crossing, minX: cut.crossing.minX - cut.flare, maxX: cut.crossing.maxX + cut.flare }
  check(`${cut.id}: no props or colliders block clear approach or sloped shoulders`,
    ENVIRONMENT.props.every((p) => !overlaps(propRect(p.x, p.z, p.kind, p.facing), shoulderRect) && !overlaps(propRect(p.x, p.z, p.kind, p.facing), cut.approach)) &&
    ENVIRONMENT.colliders.every((c) => !overlaps(c.rect, shoulderRect) && !overlaps(c.rect, cut.approach)))

  // Actual Player, both directions, no jumping or step-up needed in the vehicle throat.
  for (const inward of [true, false]) {
    const south = cut.side === 'S'
    const from = inward ? edge + (south ? 1.5 : -1.5) : edge + (south ? -4 : 4)
    const key = inward === south ? 'KeyW' : 'KeyS'
    place(cut.center, from)
    press(key)
    let lowest = Infinity, highest = -Infinity
    for (let i = 0; i < 110; i++) { run(1); lowest = Math.min(lowest, body.translation().y); highest = Math.max(highest, body.translation().y) }
    press(key, false); run(20)
    check(`${cut.id}: player ${inward ? 'road to driveway' : 'driveway to road'} crosses without barrier, jump or fall`,
      Math.abs(body.translation().z - from) > 5.5 && lowest > ROAD_TOP + FEET_OFFSET - 0.02 && highest - lowest < 0.03)
  }
  // Along the sidewalk, down one shoulder and up the other, including sprint.
  for (const key of ['KeyD', 'KeyA']) {
    const start = key === 'KeyD' ? shoulderRect.minX - 0.8 : shoulderRect.maxX + 0.8
    place(start, (s.rect.minZ + s.rect.maxZ) / 2)
    press('ShiftLeft'); press(key)
    const frames = Math.ceil((cut.width + 2 * cut.flare + 2) / 7.2 * 60)
    let lowest = Infinity, step = 0, prevY = body.translation().y
    for (let i = 0; i < frames; i++) { run(1); const y = body.translation().y; lowest = Math.min(lowest, y); step = Math.max(step, Math.abs(y - prevY)); prevY = y }
    press(key, false); press('ShiftLeft', false); run(30)
    check(`${cut.id}: sprint ${key === 'KeyD' ? 'east' : 'west'} over both pedestrian shoulders`,
      Math.abs(body.translation().x - start) > cut.width + 2 * cut.flare && lowest > ROAD_TOP + FEET_OFFSET - 0.04 && step < 0.06 && playerState.grounded, `max vertical step ${step.toFixed(4)} m`)
  }
}
check('dense real-mesh vs Rapier sampling: no holes or invisible curb barriers', holes === 0 && mismatches === 0, `max error ${maxError.toExponential(2)} m`)
check('all 40 roads remain open at low vehicle bumper height', CITY.roads.length === 40 && CITY.roads.every((r) => {
  const alongX = r.axis === 'x'
  return [0.25, 1, 2].every((height) => !cast(r.rect.minX + (alongX ? 0.1 : r.width / 2), height, r.rect.minZ + (alongX ? r.width / 2 : 0.1), alongX ? 1 : 0, 0, alongX ? 0 : 1, r.length - 0.2))
}))
check('right-hand lane graph preserved: 80 lane edges and every movement stays connected', CITY.laneEdges.length === 80 && CITY.movements.every((m) => CITY.laneEdges.some((l) => l.id === m.from) && CITY.laneEdges.some((l) => l.id === m.to)))
let total = 0, fixedBodies = 0
ctx.world.forEachCollider(() => total++)
ctx.world.forEachRigidBody((b) => { if (b.isFixed()) fixedBodies++ })
check('same collision budget: 444 environment + 57 city + ground + player; three fixed bodies', ENVIRONMENT.colliders.length === 444 && total === 503 && fixedBodies === 3, `${total} colliders, ${fixedBodies} fixed bodies`)
check('all 20 buildings and 413 existing props remain', ENVIRONMENT.buildings.length === 20 && ENVIRONMENT.props.length === 413)
const env = buildEnvironmentGeometry()
check('night lighting attributes remain attached to all six merged district meshes', env.chunks.length === 6 && env.stats.drawCalls === 12 && env.chunks.every((c) => c.geometry.getAttribute('nightEmission').count === c.geometry.getAttribute('position').count))
geometry.surface.dispose(); geometry.markings.dispose(); mesh.material.dispose()
env.chunks.forEach((c) => c.geometry.dispose()); env.paintBase.dispose(); env.paintLines.dispose(); env.signs.geometry.dispose()
await act(() => root.unmount())
console.log(fails === 0 ? 'ALL PASS' : `${fails} FAILED`)
process.exit(fails ? 1 : 0)

