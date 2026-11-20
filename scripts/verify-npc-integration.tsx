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
        <NPCSystem />
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
check('exactly two NPC bodies and five meshes each mounted',npcRegistry.size===2&&NPCS.every(d=>{const g=view.getObjectByName(`npc-${d.id}`);let meshes=0;g?.traverse(o=>{if(o instanceof THREE.Mesh)meshes++});return !!g&&meshes===5&&npcRegistry.get(d.id)!.body.isFixed()}))
const initialBodies=ctx.world.bodies.len(),initialColliders=ctx.world.colliders.len(),initialCallbacks=ctx.beforeStepCallbacks.size,initialListeners=listenerCount()
const render=(npcs=true)=><Suspense fallback={null}><Physics gravity={[0,-9.81,0]} timeStep={FIXED_DT} updatePriority={-50}><RigidBody type="fixed" colliders={false}><CuboidCollider args={[800,.5,800]} position={[0,-.5,0]}/></RigidBody><CityColliders/><EnvColliders/><VehicleSystem/>{npcs&&<NPCSystem/>}<Player/><CameraDirector/><Capture/></Physics></Suspense>
for(const d of NPCS){
 place(d.spawn.x-2,d.spawn.z)
 run(5)
 check(`${d.id}: named role hint from shared E coordinator`,useDialogueStore.getState().hint.includes(d.name)&&useDialogueStore.getState().hint.includes(d.role))
 await act(()=>{press('KeyD');press('KeyE');run(2);press('KeyE',false)})
 check(`${d.id}: one E opens only dialogue and clears held movement`,useDialogueStore.getState().active?.id===d.id&&!useVehicleStore.getState().driving&&Object.values(inputState).every(v=>!v))
 const start=body.translation()
 press('KeyW');press('Space');run(120)
 check(`${d.id}: dialogue blocks fresh movement and jump, including controller inertia`,Math.hypot(body.translation().x-start.x,body.translation().z-start.z)<.01&&Math.abs((body as unknown as {linvel():{y:number}}).linvel().y)<.05&&!inputState.jumpHeld)
 const repeat=new Event('keydown');Object.defineProperties(repeat,{code:{value:'KeyE'},repeat:{value:true},target:{value:null}});windowTarget.dispatchEvent(repeat);run(2)
 check(`${d.id}: repeated E cannot advance or enter a car`,useDialogueStore.getState().line===0&&!useVehicleStore.getState().driving)
 await act(()=>{press('Escape');run(2)})
 check(`${d.id}: Escape closes and releases controls`,useDialogueStore.getState().active===null&&Object.values(inputState).every(v=>!v))
 // A held OS repeat from a key ignored during dialogue must not restart movement.
 const held=new Event('keydown');Object.defineProperties(held,{code:{value:'KeyW'},repeat:{value:true},target:{value:null}});windowTarget.dispatchEvent(held);run(2)
 check(`${d.id}: closing requires a fresh movement press`,!inputState.forward)
 press('KeyW',false);press('KeyW');run(25);press('KeyW',false);run(30)
 check(`${d.id}: original walking resumes`,Math.hypot(body.translation().x-start.x,body.translation().z-start.z)>.5)
 await act(()=>{useDialogueStore.getState().open(d);useCharacterStore.getState().openMenu()})
 check(`${d.id}: Character Creator takes priority and closes dialogue`,useCharacterStore.getState().menuOpen&&useDialogueStore.getState().active===null)
 await act(()=>useCharacterStore.getState().cancel())
}
for(let cycle=0;cycle<4;cycle++){
 const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>()
 for(const d of NPCS)view.getObjectByName(`npc-${d.id}`)!.traverse(o=>{if(o instanceof THREE.Mesh){const m=o as THREE.Mesh<THREE.BufferGeometry,THREE.Material>;geometries.add(m.geometry);materials.add(m.material)}})
 let disposedGeometry=0,disposedMaterial=0
 geometries.forEach(g=>g.addEventListener('dispose',()=>disposedGeometry++));materials.forEach(m=>m.addEventListener('dispose',()=>disposedMaterial++))
 await act(()=>{useDialogueStore.getState().open(NPCS[0]);root.render(render(false))});run(2)
 check(`remount ${cycle}: dialogue closes, registry clears, assets dispose exactly once`,!useDialogueStore.getState().active&&npcRegistry.size===0&&disposedGeometry===10&&disposedMaterial===1)
 await act(()=>{root.render(render())});run(120)
 check(`remount ${cycle}: bodies, colliders, callbacks and listeners plateau`,npcRegistry.size===2&&ctx.world.bodies.len()===initialBodies&&ctx.world.colliders.len()===initialColliders&&ctx.beforeStepCallbacks.size===initialCallbacks&&listenerCount()===initialListeners)
}
const d=VEHICLES[0],car=getVehicleRuntime(d.id).body!
const exit=findVehicleExit(ctx,car,body as never,d)!
body.setTranslation(exit,true);run(3)
await act(()=>{press('KeyE');run(2);press('KeyE',false)})
check('walking away from NPCs still enters the real coupe',useVehicleStore.getState().activeVehicleId===d.id)
await act(()=>useDialogueStore.getState().open(NPCS[0]))
check('dialogue cannot open while driving',useDialogueStore.getState().active===null)
await act(()=>{press('KeyE');run(2);press('KeyE',false)})
check('vehicle exit still restores walking',!useVehicleStore.getState().driving)
check('camera stays finite without a dialogue camera replacement',Number.isFinite((camera as unknown as THREE.Camera).position.length()))
await act(()=>root.unmount())
check('final unmount leaves no NPC references/dialogue/listeners',npcRegistry.size===0&&!useDialogueStore.getState().active&&listenerCount()===0)
console.log(fails?`${fails} FAILED`:'ALL PASS')
process.exit(fails?1:0)
