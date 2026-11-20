/** Actual R3F Player + StreetCoupe + CameraDirector in the existing fixed-step Rapier world. */
import { Suspense, useEffect } from 'react'
import { advance, act as rawAct, createRoot, extend, useThree } from '@react-three/fiber'
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

const { StreetCoupe } = await import('../src/game/vehicles/StreetCoupe')
const { CameraDirector, selectActiveCamera } = await import('../src/game/camera/CameraDirector')
const { useVehicleStore, vehicleRuntime, vehicleState } = await import('../src/game/vehicles/vehicleState')
const { COUPE } = await import('../src/game/vehicles/vehicleConfig')
const { inputState } = await import('../src/game/input/inputState')
const { Player } = await import('../src/game/character')
const { FIXED_DT, FEET_OFFSET } = await import('../src/game/character/config')
const { playerState } = await import('../src/game/character/playerState')
const { resetInput } = await import('../src/game/input/inputState')
const { useCharacterStore } = await import('../src/game/state/characterStore')
const { CityColliders } = await import('../src/game/city')
const { EnvColliders } = await import('../src/game/environment')
const { surfaceHeightAt } = await import('../src/game/city/citySurface')

let fails = 0
const check = (name: string, ok: boolean, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${info}`); if (!ok) fails++ }

type Ctx = ReturnType<typeof useRapier>
let rapier: Ctx | null = null
let scene: THREE.Scene | null = null
let camera: THREE.Camera | null = null
function Capture() { const c = useRapier(); const view = useThree(); useEffect(() => { rapier = c; scene = view.scene; camera = view.camera }); return null }

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
        <StreetCoupe />
        <Player />
        <CameraDirector />
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
const player = () => { let b: unknown = null; ctx.world.forEachRigidBody((x) => { if (x.isDynamic() && x.numColliders() && x.collider(0).shapeType() === ctx.rapier.ShapeType.Capsule) b = x }); return b as Body }
const body = player()
const press = (code: string, down = true) => {
  const e = new Event(down ? 'keydown' : 'keyup')
  Object.defineProperties(e, { code: { value: code }, repeat: { value: false }, target: { value: null }, metaKey: { value: false }, preventDefault: { value: noop } })
  windowTarget.dispatchEvent(e)
}
const place = (x: number, z: number) => { resetInput(); body.setTranslation({ x, y: surfaceHeightAt(x, z) + FEET_OFFSET + 0.05, z }, true); run(60) }

await act(() => { useCharacterStore.getState().setName('Ace'); useCharacterStore.getState().confirm() })
run(240)

check('one actual coupe body with six colliders alongside the original player', !!vehicleRuntime.body && vehicleRuntime.body.numColliders() === 6 && vehicleRuntime.pedestrian === body)
check('walking camera remains active before entry', selectActiveCamera(false,'follow',useVehicleStore.getState().driving) === 'follow')
const car = vehicleRuntime.body!
place(COUPE.spawn.x - 2,COUPE.spawn.z)
run(5)
check('nearby pedestrian receives a contextual E hint', useVehicleStore.getState().hint.includes('E — Enter'))
await act(() => { useCharacterStore.getState().openMenu() })
press('KeyE');run(3)
check('E is ignored while creator owns input', !useVehicleStore.getState().driving && !inputState.interactQueued)
await act(() => { useCharacterStore.getState().cancel() })
press('KeyW')
await act(() => { press('KeyE'); run(2); press('KeyE',false) })
check('E enters via shared listener and disables the pedestrian collider/body', useVehicleStore.getState().driving && !(body as unknown as {isEnabled():boolean}).isEnabled())
check('entry clears walking throttle/jump so there is no stuck acceleration', !inputState.forward && !inputState.jumpQueued && !inputState.interactQueued)
const repeated=new Event('keydown')
Object.defineProperties(repeated,{code:{value:'KeyW'},repeat:{value:true},target:{value:null},metaKey:{value:false}})
windowTarget.dispatchEvent(repeated)
check('OS key repeat cannot re-activate walking keys after the mode reset', !inputState.forward)
check('pedestrian visual hides while the vehicle camera takes over', !(scene as unknown as THREE.Scene).getObjectByName('pedestrian-visual')!.visible && selectActiveCamera(false,'follow',true)==='vehicle')
const carStart=car.translation(), parkedPedestrian=body.translation()
press('KeyW');run(100);press('KeyW',false)
check('real mounted vehicle advances through Rapier; pedestrian body stays non-interfering', car.translation().z>carStart.z+8 && Math.abs(body.translation().x-parkedPedestrian.x)<.01)
check('player-following world systems receive the interpolated vehicle location', playerState.position.distanceTo(vehicleState.position)<.01)
const wheel=(scene as unknown as THREE.Scene).getObjectByName('coupe-wheel-0')!
check('actual wheel meshes roll with travel', Math.abs(wheel.children[0].rotation.x)>5)
press('KeyA');run(20);press('KeyA',false)
check('front wheel steer meshes respond while rear axle stays straight', wheel.rotation.y>.1 && Math.abs((scene as unknown as THREE.Scene).getObjectByName('coupe-wheel-2')!.rotation.y)<.001)
const blur = new Event('blur');windowTarget.dispatchEvent(blur)
check('browser focus loss releases throttle, steering, handbrake and E queue', Object.values(inputState).every((value)=>value===false))
const view=camera as unknown as THREE.Camera
check('vehicle camera has a finite real pose', Number.isFinite(view.position.x+view.position.y+view.position.z))
press('Space');run(120);press('Space',false)
check('handbrake stops the mounted vehicle before exit', Math.abs(vehicleState.speed)<.2)
const beforeExit=car.translation()
await act(() => { press('KeyE');run(2);press('KeyE',false) })
run(90)
check('E exits, restores the pedestrian body, visual and walking camera', !useVehicleStore.getState().driving && (body as unknown as {isEnabled():boolean}).isEnabled() && (scene as unknown as THREE.Scene).getObjectByName('pedestrian-visual')!.visible && selectActiveCamera(false,'follow',false)==='follow')
check('exit preserves the parked car pose', Math.hypot(car.translation().x-beforeExit.x,car.translation().z-beforeExit.z)<.1)
const foot=body.translation()
check('exit lands on real valid ground instead of chassis or a building', Math.abs(foot.y-(surfaceHeightAt(foot.x,foot.z)+FEET_OFFSET))<.03)
press('KeyD');run(60);press('KeyD',false)
check('walking resumes through the original controller after exit', Math.hypot(body.translation().x-foot.x,body.translation().z-foot.z)>2)
await act(() => root.unmount())
console.log(fails ? `${fails} FAILED` : 'ALL PASS')
process.exit(fails ? 1 : 0)

