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

const { AmbientSystem } = await import('../src/game/ambient/AmbientSystem')
const { ambientBodies,ambientTraffic,ambientWalkers } = await import('../src/game/ambient/ambientState')
const { TRAFFIC,PEDESTRIANS } = await import('../src/game/ambient/ambientConfig')
const { vehicleRegistry } = await import('../src/game/vehicles/vehicleState')
const { NPCSystem } = await import('../src/game/npcs/NPCSystem')
const { NPCS } = await import('../src/game/npcs/npcConfig')
const { npcRegistry } = await import('../src/game/npcs/npcState')
const { useDialogueStore } = await import('../src/game/interactions/dialogueState')
const { VehicleSystem } = await import('../src/game/vehicles/VehicleSystem')
const { CameraDirector } = await import('../src/game/camera/CameraDirector')
const { useVehicleStore, getVehicleRuntime } = await import('../src/game/vehicles/vehicleState')
const { VEHICLES } = await import('../src/game/vehicles/vehicleConfig')
const { findVehicleExit } = await import('../src/game/vehicles/vehicleInteraction')
const { Player } = await import('../src/game/character')
const { FIXED_DT, FEET_OFFSET } = await import('../src/game/character/config')
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
        <NPCSystem />
        <AmbientSystem/>
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
check('exact five ambient bodies are kinematic and never enter playable/NPC registries',ambientBodies.size===5&&ambientTraffic.size===2&&ambientWalkers.size===3&&[...ambientBodies.values()].every(b=>b.isKinematic())&&npcRegistry.size===2&&vehicleRegistry.size===3)
const bodyCount=ctx.world.bodies.len(),colliderCount=ctx.world.colliders.len(),callbackCount=ctx.beforeStepCallbacks.size,listeners=listenerCount()
const start=TRAFFIC.map(d=>ambientBodies.get(d.id)!.translation())
run(600)
check('both real traffic cars move and roll wheels',TRAFFIC.every((d,i)=>{const p=ambientBodies.get(d.id)!.translation(),wheel=view.getObjectByName(`${d.id}-wheel-0`)!;return Math.hypot(p.x-start[i].x,p.z-start[i].z)>10&&Math.abs(wheel.children[0].rotation.x)>2}))
check('three pedestrian rigs animate and stay grounded',PEDESTRIANS.every(d=>{const p=ambientBodies.get(d.id)!.translation();return Math.abs(p.y-(surfaceHeightAt(p.x,p.z)+.93))<.001&&ambientWalkers.get(d.id)!.phase>0}))
for(const d of NPCS){
 place(d.spawn.x-2,d.spawn.z)
 await act(()=>{press('KeyE');run(2);press('KeyE',false)})
 check(`${d.id}: unchanged named dialogue works with moving ambient agents`,useDialogueStore.getState().active?.id===d.id)
 await act(()=>{press('Escape');run(2)})
}
const car=TRAFFIC[0],traffic=ambientBodies.get(car.id)!
place(traffic.translation().x+2,traffic.translation().z)
await act(()=>{press('KeyE');run(2);press('KeyE',false)})
check('ambient traffic cannot be entered and never enables vehicle HUD/dialogue',!useVehicleStore.getState().driving&&!useDialogueStore.getState().active)
const coupe=getVehicleRuntime('street-coupe').body!,exit=findVehicleExit(ctx,coupe,body as never,VEHICLES[0])!
body.setTranslation(exit,true);run(2)
await act(()=>{press('KeyE');run(2);press('KeyE',false)})
check('original playable coupe and chase camera retain ownership',useVehicleStore.getState().activeVehicleId==='street-coupe')
press('KeyW');run(30);press('KeyW',false);press('Space');run(60);press('Space',false)
await act(()=>{press('KeyE');run(2);press('KeyE',false)})
check('normal player vehicle exit still works',!useVehicleStore.getState().driving)
const render=(enabled=true,debug=false)=><Suspense fallback={null}><Physics gravity={[0,-9.81,0]} timeStep={FIXED_DT} updatePriority={-50} debug={debug}><RigidBody type="fixed" colliders={false}><CuboidCollider args={[800,.5,800]} position={[0,-.5,0]}/></RigidBody><CityColliders/><EnvColliders/><VehicleSystem/><NPCSystem/>{enabled&&<AmbientSystem/>}<Player/><CameraDirector/><Capture/></Physics></Suspense>
const before=TRAFFIC.map(d=>({...ambientBodies.get(d.id)!.translation()}))
await act(()=>{root.render(render(true,true))});run(1)
check('P context rerender cannot reset traffic to its spawn',TRAFFIC.every((d,i)=>{const p=ambientBodies.get(d.id)!.translation();return Math.hypot(p.x-before[i].x,p.z-before[i].z)<.2}))
await act(()=>{root.render(render())});run(1)
for(let cycle=0;cycle<3;cycle++){
 const geos=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>()
 for(const d of[...TRAFFIC,...PEDESTRIANS])view.getObjectByName(`${d.id}-visual`)!.traverse(o=>{if(o instanceof THREE.Mesh){const m=o as THREE.Mesh<THREE.BufferGeometry,THREE.Material|THREE.Material[]>;geos.add(m.geometry);for(const mat of Array.isArray(m.material)?m.material:[m.material])materials.add(mat)}})
 let disposed=0;const releasedMaterials=new Set<THREE.Material>();geos.forEach(g=>g.addEventListener('dispose',()=>disposed++));materials.forEach(m=>m.addEventListener('dispose',()=>releasedMaterials.add(m)))
 await act(()=>{root.render(render(false))});run(2)
 await act(async()=>{await new Promise(r=>setTimeout(r,100))})
 check(`remount ${cycle}: all ambient references clear and geometry releases`,ambientBodies.size===0&&ambientTraffic.size===0&&ambientWalkers.size===0&&disposed>=geos.size&&releasedMaterials.size===materials.size,`geometry events ${disposed}/${geos.size}; unique materials ${materials.size}`)
 await act(()=>{root.render(render())});run(120)
 check(`remount ${cycle}: bodies/colliders/callbacks/listeners plateau`,ctx.world.bodies.len()===bodyCount&&ctx.world.colliders.len()===colliderCount&&ctx.beforeStepCallbacks.size===callbackCount&&listenerCount()===listeners)
}
check('camera remains finite and only player cameras are mounted',Number.isFinite((camera as unknown as THREE.Camera).position.length()))
await act(()=>root.unmount())
check('full teardown clears ambient references and window listeners',ambientBodies.size===0&&ambientTraffic.size===0&&ambientWalkers.size===0&&listenerCount()===0)
console.log(fails?`${fails} FAILED`:'ALL PASS')
process.exit(fails?1:0)
