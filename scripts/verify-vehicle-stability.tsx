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
const listenerSets=new Map<string,Set<EventListenerOrEventListenerObject>>()
const add=windowTarget.addEventListener.bind(windowTarget),remove=windowTarget.removeEventListener.bind(windowTarget)
windowTarget.addEventListener=(type,listener,options)=>{if(listener){if(!listenerSets.has(type))listenerSets.set(type,new Set());listenerSets.get(type)!.add(listener)};add(type,listener,options)}
windowTarget.removeEventListener=(type,listener,options)=>{if(listener)listenerSets.get(type)?.delete(listener);remove(type,listener,options)}
const listenerCount=()=>[...listenerSets.values()].reduce((n,set)=>n+set.size,0)
const store = new Map<string, string>()
Object.assign(windowTarget, { navigator: { userAgent: 'headless' }, innerWidth: 1280, innerHeight: 720, localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) } })
Object.assign(globalThis, { HTMLElement: FakeElement, window: windowTarget, document: Object.assign(new EventTarget(), { hidden: false }) })

const { VehicleSystem } = await import('../src/game/vehicles/VehicleSystem')
const { CameraDirector } = await import('../src/game/camera/CameraDirector')
const { useVehicleStore, getVehicleRuntime } = await import('../src/game/vehicles/vehicleState')
const { VEHICLES } = await import('../src/game/vehicles/vehicleConfig')
const { findVehicleExit } = await import('../src/game/vehicles/vehicleInteraction')
const { Player } = await import('../src/game/character')
const { FIXED_DT, FEET_OFFSET } = await import('../src/game/character/config')
const { inputState, resetInput } = await import('../src/game/input/inputState')
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


const view=scene as unknown as THREE.Scene
const common=(view.getObjectByName('vextride-street-coupe')!.children[1] as THREE.Mesh).material as THREE.Material
let disposed=0;common.addEventListener('dispose',()=>disposed++)
const render=(definitions=VEHICLES,debug=false)=><Suspense fallback={null}><Physics gravity={[0,-9.81,0]} timeStep={FIXED_DT} updatePriority={-50} debug={debug}><RigidBody type="fixed" colliders={false}><CuboidCollider args={[800,.5,800]} position={[0,-.5,0]}/></RigidBody><CityColliders/><EnvColliders/><VehicleSystem definitions={definitions}/><Player/><CameraDirector/><Capture/></Physics></Suspense>
await act(()=>{root.render(render(VEHICLES.filter(d=>d.id!=='street-coupe')))});run(5)
await act(async()=>{await new Promise(r=>setTimeout(r,100))})
check('removing one car does not dispose materials shared by surviving vehicles',disposed===0,`dispose events ${disposed}`)
await act(()=>{root.render(render())});run(120)
const coupe=getVehicleRuntime('street-coupe').body!
coupe.setTranslation({x:0,y:.55,z:0},true);coupe.setRotation({x:0,y:0,z:0,w:1},true);run(120)
place(-1.7,0)
await act(()=>{press('KeyW');press('KeyE');run(2);press('KeyE',false)})
check('entry resets held throttle and selects the coupe',useVehicleStore.getState().activeVehicleId==='street-coupe'&&!inputState.forward)
const pbody=body as unknown as {isEnabled():boolean}
check('pedestrian disabled before active unmount',!pbody.isEnabled())
await act(()=>{root.render(render(VEHICLES.filter(d=>d.id!=='street-coupe')))});run(5)
check('active-car removal clears driving ownership and held inputs',!useVehicleStore.getState().driving&&Object.values(inputState).every(v=>!v))
check('active-car removal restores pedestrian body',pbody.isEnabled())
check('removed body is not retained in registry',getVehicleRuntime('street-coupe').body===null)
await act(()=>{root.render(render())});run(150)
const bodyCount=ctx.world.bodies.len(),colliderCount=ctx.world.colliders.len(),callbacks=ctx.beforeStepCallbacks.size,listeners=listenerCount()
for(let cycle=0;cycle<12;cycle++){
  const d=VEHICLES[cycle%3],car=getVehicleRuntime(d.id).body!
  const exit=findVehicleExit(ctx,car,body as never,d)!
  check(`cycle ${cycle}: validated approach exists`,!!exit)
  body.setTranslation(exit,true);run(2)
  await act(()=>{press('KeyA');press('KeyE');run(2);press('KeyE',false)})
  check(`cycle ${cycle}: nearest car selected and held steering cleared`,useVehicleStore.getState().activeVehicleId===d.id&&!inputState.left)
  const repeated=new Event('keydown');Object.defineProperties(repeated,{code:{value:'KeyE'},repeat:{value:true},target:{value:null}});windowTarget.dispatchEvent(repeated);run(2)
  check(`cycle ${cycle}: E repeat cannot exit`,useVehicleStore.getState().driving)
  if(cycle===0){
    await act(()=>{root.render(render(VEHICLES,true))});run(2)
    check('P debug context updates cannot detach an occupied car',useVehicleStore.getState().activeVehicleId===d.id&&!pbody.isEnabled())
    await act(()=>{root.render(render())});run(2)
  }
  press('KeyW');run(30);windowTarget.dispatchEvent(new Event('blur'));run(120)
  check(`cycle ${cycle}: focus loss resets throttle and settles`,Object.values(inputState).every(v=>!v)&&Math.abs(getVehicleRuntime(d.id).state.speed)<.15)
  await act(()=>{press('KeyD');press('KeyE');run(2);press('KeyE',false)})
  check(`cycle ${cycle}: safe exit restores walking and clears steering`,!useVehicleStore.getState().driving&&pbody.isEnabled()&&!inputState.right)
}
for(let cycle=0;cycle<4;cycle++){
  const geos=new Set<THREE.BufferGeometry>(),mats=new Set<THREE.Material>()
  for(const d of VEHICLES)view.getObjectByName(`vextride-${d.id}`)!.traverse(o=>{
    if(o instanceof THREE.Mesh){
      const mesh=o as THREE.Mesh<THREE.BufferGeometry,THREE.Material|THREE.Material[]>
      geos.add(mesh.geometry)
      for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])mats.add(material)
    }
  })
  let g=0,m=0;geos.forEach(o=>o.addEventListener('dispose',()=>g++));mats.forEach(o=>o.addEventListener('dispose',()=>m++))
  await act(()=>{root.render(render([]))});run(2)
  check(`remount ${cycle}: all vehicle references removed`,VEHICLES.every(d=>getVehicleRuntime(d.id).body===null))
  await act(()=>{root.render(render())});run(150)
  // The fleet owns shared materials; they survive individual car removal, then dispose on full-system unmount.
  check(`remount ${cycle}: geometry released and body/collider/callback counts stable`,g===geos.size&&m===mats.size-3&&ctx.world.bodies.len()===bodyCount&&ctx.world.colliders.len()===colliderCount&&ctx.beforeStepCallbacks.size===callbacks&&listenerCount()===listeners,`geometry disposals ${g}/${geos.size}; material disposals ${m}/${mats.size}`)
}
check('camera remains finite after repeated switches/remounts',Number.isFinite((camera as unknown as THREE.Camera).position.length()))
await act(()=>root.unmount())
check('full unmount releases shared material once and removes all window listeners',disposed===1&&listenerCount()===0)
console.log(fails?`${fails} FAILED`:'ALL PASS')
process.exit(fails?1:0)
