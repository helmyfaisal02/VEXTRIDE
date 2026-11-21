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

const { VehicleSystem } = await import('../src/game/vehicles/VehicleSystem')
const { CameraDirector, selectActiveCamera } = await import('../src/game/camera/CameraDirector')
const { useVehicleStore, getVehicleRuntime, getActiveVehicleDefinition } = await import('../src/game/vehicles/vehicleState')
const { VEHICLES } = await import('../src/game/vehicles/vehicleConfig')
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
        <VehicleSystem />
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

check('three actual vehicle bodies coexist with the original pedestrian', VEHICLES.every(d=>!!getVehicleRuntime(d.id).body) && VEHICLES.map(d=>getVehicleRuntime(d.id).body!.handle).every((h,i,a)=>a.indexOf(h)===i))
check('all parked bodies sleep after settling', VEHICLES.every(d=>getVehicleRuntime(d.id).body!.isSleeping()))
const meshes=VEHICLES.map(d=>(scene as unknown as THREE.Scene).getObjectByName(`vextride-${d.id}`)!)
check('three distinct models each retain four independent wheel groups', meshes.every((g,i)=>g.children.filter(c=>c.name.startsWith(`${VEHICLES[i].modelType}-wheel-`)).length===4))
const bodies=meshes.map(g=>(g.children[0] as THREE.Mesh).material)
const tails=meshes.map(g=>(g.children[4] as THREE.Mesh).material)
check('paint slots and brake lights are independent while glass remains shared',new Set(bodies).size===3&&(meshes[0].children[1] as THREE.Mesh).material===(meshes[1].children[1] as THREE.Mesh).material&&tails[0]!==tails[1]&&tails[1]!==tails[2])

// Controlled test arrangement on a clear road. Production spawns are checked separately.
VEHICLES.forEach((d,i)=>{
  const b=getVehicleRuntime(d.id).body!
  b.setTranslation({x:i*6,y:.03+d.rideHeight+.02,z:0},true)
  b.setRotation({x:0,y:0,z:0,w:1},true);b.setLinvel({x:0,y:0,z:0},true);b.setAngvel({x:0,y:0,z:0},true)
})
run(180);place(-2,0)
for(let i=0;i<VEHICLES.length;i++){
  const d=VEHICLES[i],entry=getVehicleRuntime(d.id),car=entry.body!
  run(20)
  check(`${d.id}: approaching on foot shows its own E hint`,useVehicleStore.getState().hint.includes(d.name))
  const other=VEHICLES.filter(v=>v.id!==d.id).map(v=>({id:v.id,p:getVehicleRuntime(v.id).body!.translation()}))
  await act(()=>{press('KeyE');run(2);press('KeyE',false)})
  check(`${d.id}: E selects only this vehicle and wakes it`,useVehicleStore.getState().activeVehicleId===d.id&&!car.isSleeping()&&!(body as unknown as {isEnabled():boolean}).isEnabled())
  check(`${d.id}: HUD definition and chase target refer to occupied vehicle`,getActiveVehicleDefinition().name===d.name&&playerState.position.distanceTo(entry.state.position)<.01&&selectActiveCamera(false,'follow',true)==='vehicle')
  press('KeyW');run(8);press('KeyW',false)
  check(`${d.id}: only the occupied body accelerates`,entry.state.speed>.1&&other.every(o=>{const p=getVehicleRuntime(o.id).body!.translation();return Math.hypot(p.x-o.p.x,p.z-o.p.z)<.001}))
  const front=(scene as unknown as THREE.Scene).getObjectByName(`${d.modelType}-wheel-0`)!
  check(`${d.id}: actual wheel group rolls from resolved travel`,Math.abs(front.children[0].rotation.x)>.001)
  press('KeyS');run(3);press('KeyS',false)
  const activeTail=(meshes[i].children[4] as THREE.Mesh).material as THREE.MeshStandardMaterial
  // Brake emission was set on the previous held-key frame; other cars must not inherit it.
  check(`${d.id}: braking does not illuminate unoccupied brake lights`,activeTail.emissiveIntensity>1&&meshes.filter((_,n)=>n!==i).every(m=>((m.children[4] as THREE.Mesh).material as THREE.MeshStandardMaterial).emissiveIntensity<1))
  press('Space');run(60);press('Space',false)
  const pose=car.translation()
  await act(()=>{press('KeyE');run(2);press('KeyE',false)});run(90)
  check(`${d.id}: exit restores original walking with capsule on valid ground`,!useVehicleStore.getState().driving&&(body as unknown as {isEnabled():boolean}).isEnabled()&&Math.abs(body.translation().y-(surfaceHeightAt(body.translation().x,body.translation().z)+FEET_OFFSET))<.03)
  check(`${d.id}: all prior parked vehicles retain poses and remain visible`,Math.hypot(car.translation().x-pose.x,car.translation().z-pose.z)<.02&&meshes.every(m=>m.visible)&&other.every(o=>{const p=getVehicleRuntime(o.id).body!.translation();return Math.hypot(p.x-o.p.x,p.z-o.p.z)<.001}))
  if(i<VEHICLES.length-1){
    const start=body.translation()
    // Actual pedestrian controller walks around the parked rear, then toward the next driver door.
    press('KeyS');run(65);press('KeyS',false);run(10)
    press('KeyD');run(100);press('KeyD',false);run(10)
    press('KeyW');run(65);press('KeyW',false);run(20)
    check(`walk from ${d.id} to next vehicle without a selection menu`,Math.hypot(body.translation().x-start.x,body.translation().z-start.z)>5)
  }
}
check('all three unoccupied bodies can return to sleep',(()=>{run(240);return VEHICLES.every(d=>getVehicleRuntime(d.id).body!.isSleeping())})())
const view=camera as unknown as THREE.Camera
check('camera pose remains finite across every entry/exit hand-over',Number.isFinite(view.position.x+view.position.y+view.position.z))
await act(()=>root.unmount())
console.log(fails?`${fails} FAILED`:'ALL PASS')
process.exit(fails?1:0)

