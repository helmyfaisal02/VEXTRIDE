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

const { GARAGE } = await import('../src/game/garage/garageConfig')
const { useGarageStore,garageRuntime } = await import('../src/game/garage/garageState')
const { GarageSystem } = await import('../src/game/garage/GarageSystem')
const { CHECKPOINTS } = await import('../src/game/missions/checkpointRoute')
const { MissionDriver } = await import('../src/game/missions/MissionDriver')
const { useMissionStore,missionStatus } = await import('../src/game/missions/missionState')
const { acceptMission,declineMission,acknowledgeObjective } = await import('../src/game/missions/missionManager')
const { missionHUD,missionTarget } = await import('../src/game/missions/missionPresentation')
const { AmbientSystem } = await import('../src/game/ambient/AmbientSystem')
const { ambientBodies,ambientTraffic } = await import('../src/game/ambient/ambientState')
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
let camera: THREE.Camera | null = null
let scene:THREE.Scene|null=null
function Capture() { const c = useRapier(); const view = useThree(); useEffect(() => { rapier = c; camera = view.camera;scene=view.scene }); return null }

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
        <VehicleSystem /><MissionDriver/><GarageSystem/>
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





const counts={body:ctx.world.bodies.len(),collider:ctx.world.colliders.len(),callback:ctx.beforeStepCallbacks.size,listeners:listenerCount()}
const trafficStart=ambientTraffic.get('ambient-coupe')!.distance
place(GARAGE.terminal.x,GARAGE.terminal.z+1.7)
await act(()=>{press('KeyW');press('KeyE');run(2);press('KeyE',false)})
check('walking E opens garage and clears held movement without NPC dialogue',useGarageStore.getState().open&&!useDialogueStore.getState().active)
const servicePosition={...body.translation()}
await act(()=>{press('KeyW');press('KeyE');run(60);press('KeyE',false)})
check('open garage blocks walking and duplicate E without camera replacement',Math.hypot(body.translation().x-servicePosition.x,body.translation().z-servicePosition.z)<.02&&useGarageStore.getState().open)
await act(()=>{press('Escape');run(2)})
check('shared Escape closes garage and restores cleared input',!useGarageStore.getState().open)
await act(()=>{press('KeyE');run(2);press('KeyE',false);useCharacterStore.getState().openMenu();run(2)})
check('creator takes precedence and closes the garage',!useGarageStore.getState().open)
await act(()=>{useCharacterStore.getState().cancel();run(2)})

async function talk(id:'maya'|'marcus'){
 const n=NPCS.find(n=>n.id===id)!;place(n.spawn.x-2,n.spawn.z)
 await act(()=>{press('KeyE');run(2);press('KeyE',false)})
 check(`${id}: shared E opens original on-foot dialogue`,useDialogueStore.getState().active?.id===id)
 return useDialogueStore.getState().session
}
let session=await talk('marcus')
check('Marcus cannot accept before Maya; ordinary lines remain',!acceptMission(session)&&useDialogueStore.getState().active?.lines===NPCS[0].lines&&useMissionStore.getState().progress.status==='NOT_STARTED')
await act(()=>{press('Escape');run(2)})
session=await talk('maya')
check('talking to Maya does not automatically accept',useMissionStore.getState().progress.status==='NOT_STARTED')
await act(()=>{declineMission(session);run(2)})
check('declining restores walking and leaves mission available',!useDialogueStore.getState().active&&useMissionStore.getState().progress.status==='NOT_STARTED')
session=await talk('maya')
await act(()=>{acceptMission(session);run(2)})
const accepted=useMissionStore.getState().progress
check('acceptance activates Marcus objective and clears dialogue input',accepted.status==='ACTIVE'&&accepted.objectiveId==='meet-marcus'&&!useDialogueStore.getState().active)
check('first HUD waypoint references actual Marcus definition',missionHUD(accepted)?.target===NPCS[0]&&missionTarget(accepted)===NPCS[0])
await act(()=>{useCharacterStore.getState().openMenu();run(2)})
check('creator open leaves mission coherent',useMissionStore.getState().progress===accepted)
await act(()=>{useCharacterStore.getState().cancel();run(2)})
const render=(npcs=true,garage=true)=><Suspense fallback={null}><Physics gravity={[0,-9.81,0]} timeStep={FIXED_DT} updatePriority={-50}><RigidBody type="fixed" colliders={false}><CuboidCollider args={[800,.5,800]} position={[0,-.5,0]}/></RigidBody><CityColliders/><EnvColliders/><VehicleSystem/><MissionDriver/>{garage&&<GarageSystem/>}{npcs&&<NPCSystem/>}<AmbientSystem/><Player/><CameraDirector/><Capture/></Physics></Suspense>
session=await talk('marcus')
await act(()=>{root.render(render(false))});run(2)
check('NPC unmount closes dialogue and invalidates stale mission acknowledgement',!useDialogueStore.getState().active&&!acknowledgeObjective('meet-marcus',session)&&useMissionStore.getState().progress===accepted)
await act(()=>{root.render(render())});run(120)
check('NPC remount preserves active objective with fresh registry bodies',npcRegistry.size===2&&useMissionStore.getState().progress===accepted&&ctx.world.bodies.len()===counts.body&&ctx.world.colliders.len()===counts.collider)
for(const d of VEHICLES){
 const car=getVehicleRuntime(d.id).body!,exit=findVehicleExit(ctx,car,body as never,d)!
 body.setTranslation(exit,true);run(3)
 await act(()=>{press('KeyE');run(2);press('KeyE',false)})
 check(`${d.id}: mission travel uses original vehicle ownership`,useVehicleStore.getState().activeVehicleId===d.id)
 check(`${d.id}: driving cannot acknowledge a dialogue objective`,!acknowledgeObjective('meet-marcus',useDialogueStore.getState().session)&&useMissionStore.getState().progress===accepted)
 press('KeyW');run(15);press('KeyW',false);press('Space');run(60);press('Space',false)
 await act(()=>{press('KeyE');run(2);press('KeyE',false)})
 check(`${d.id}: E exits only, never progresses mission`,!useVehicleStore.getState().driving&&useMissionStore.getState().progress===accepted)
}
session=await talk('marcus')
const repeated=new Event('keydown');Object.defineProperties(repeated,{code:{value:'KeyE'},repeat:{value:true},target:{value:null}});windowTarget.dispatchEvent(repeated);run(3)
check('repeated E cannot acknowledge Marcus',useMissionStore.getState().progress===accepted)
windowTarget.dispatchEvent(new Event('blur'));run(2)
check('focus loss cannot progress mission',useMissionStore.getState().progress===accepted)
await act(()=>{press('Escape');run(2)})
check('early Escape retains Marcus objective',useMissionStore.getState().progress===accepted)
session=await talk('marcus')
await act(()=>{acknowledgeObjective('meet-marcus',session);run(2)})
check('explicit Marcus acknowledgement updates objective and waypoint once',useMissionStore.getState().progress.objectiveId==='return-to-maya'&&missionTarget(useMissionStore.getState().progress)===NPCS[1]&&!acknowledgeObjective('meet-marcus',session))
session=await talk('maya')
check('return conversation alone does not complete',useMissionStore.getState().progress.status==='ACTIVE')
await act(()=>{acknowledgeObjective('return-to-maya',session);run(2)})
check('final acknowledgement completes with confirmation and no stale waypoint',useMissionStore.getState().progress.status==='COMPLETED'&&useMissionStore.getState().completionNotice&&missionHUD(useMissionStore.getState().progress)===null&&missionTarget(useMissionStore.getState().progress)===null)
session=await talk('maya')
check('completed mission cannot restart; Maya normal dialogue retained',!acceptMission(session)&&useDialogueStore.getState().active?.lines===NPCS[1].lines)
await act(()=>{press('Escape');run(2)})
session=await talk('marcus')
await act(()=>{declineMission(session,'motor-row-shakedown');run(2)})
check('second mission decline leaves First Contact completed',missionStatus(useMissionStore.getState().progress,'first-contact')==='COMPLETED'&&useMissionStore.getState().progress.missionId==='first-contact')
session=await talk('marcus')
await act(()=>{acceptMission(session,'motor-row-shakedown');run(2)})
check('Marcus acceptance unlocks the first driving gate only',useMissionStore.getState().progress.objectiveId==='checkpoint-a'&&missionStatus(useMissionStore.getState().progress,'first-contact')==='COMPLETED')
session=await talk('marcus')
check('early Marcus report cannot skip checkpoints',!acknowledgeObjective('report-to-marcus',session))
await act(()=>{press('Escape');run(2)})
for(let i=0;i<CHECKPOINTS.length;i++){
 const g=CHECKPOINTS[i],d=VEHICLES[i],car=getVehicleRuntime(d.id).body!,yaw=Math.atan2(-g.direction.x,-g.direction.z)
 // Fixture positioning sets up each car; the observed crossing itself is real fixed-step driving.
 car.setTranslation({x:g.spawn.x-g.direction.x*8,y:g.spawn.y+d.rideHeight+.03,z:g.spawn.z-g.direction.z*8},true)
 car.setRotation({x:0,y:Math.sin(yaw/2),z:0,w:Math.cos(yaw/2)},true);car.setLinvel({x:0,y:0,z:0},true);car.setAngvel({x:0,y:0,z:0},true);run(45)
 const exit=findVehicleExit(ctx,car,body as never,d)!
 body.setTranslation(exit,true);run(3)
 await act(()=>{press('KeyE');run(2);press('KeyE',false)})
 check(`${d.id}: checkpoint travel enters only the selected player vehicle`,useVehicleStore.getState().activeVehicleId===d.id)
 await act(()=>{press('KeyW');for(let j=0;j<210&&useMissionStore.getState().progress.objectiveId===g.id;j++)run(1);press('KeyW',false);press('Space');run(90);press('Space',false)})
 check(`${d.id}: actual post-physics movement advances its ordered gate`,useMissionStore.getState().progress.objectiveId!==g.id)
 await act(()=>{press('KeyE');run(2);press('KeyE',false)})
 check(`${d.id}: safe exit and vehicle switching preserve checkpoint progress`,!useVehicleStore.getState().driving&&useMissionStore.getState().progress.status==='ACTIVE')
}
check('third gate selects actual Marcus return target',useMissionStore.getState().progress.objectiveId==='report-to-marcus'&&missionTarget(useMissionStore.getState().progress)===NPCS[0])
session=await talk('marcus')
await act(()=>{acknowledgeObjective('report-to-marcus',session);run(2)})
check('final on-foot acknowledgement completes second mission exactly once',useMissionStore.getState().progress.status==='COMPLETED'&&useMissionStore.getState().progress.completed?.length===2&&!acknowledgeObjective('report-to-marcus',session))
await act(()=>{root.render(render(false))});run(2)
await act(()=>{root.render(render())});run(30)
check('combined mission history and one observer survive remount',useMissionStore.getState().progress.completed?.length===2&&ctx.afterStepCallbacks.size===2)
for(let i=0;i<2;i++){
 const b=GARAGE.bays[i],d=VEHICLES[i],car=getVehicleRuntime(d.id).body!
 // Test setup outside the bay; crossing and stop use the real controller and observed physics.
 car.setTranslation({x:b.x,y:b.y+d.rideHeight+.03,z:b.z+6.5},true);car.setRotation({x:0,y:0,z:0,w:1},true);car.setLinvel({x:0,y:0,z:0},true);car.setAngvel({x:0,y:0,z:0},true);run(45)
 body.setTranslation(findVehicleExit(ctx,car,body as never,d)!,true);run(3)
 await act(()=>{press('KeyE');run(2);press('KeyE',false)})
 check(`${d.id}: garage approach enters the real car`,useVehicleStore.getState().activeVehicleId===d.id)
 await act(()=>{
  for(let j=0;j<450&&car.translation().z>b.z+.15;j++){
   const v=car.linvel();press('KeyW',Math.hypot(v.x,v.z)<2.1);run(1)
  }
  press('KeyW',false);press('Space');run(90);press('Space',false);press('KeyE');run(2);press('KeyE',false);run(90)
 })
 check(`${d.id}: physical parking and safe exit confirm exclusive bay occupancy`,useGarageStore.getState().occupancy[b.id]===d.id&&!useVehicleStore.getState().driving)
}
check('two parked vehicles coexist without duplicate bay or vehicle assignments',Object.keys(useGarageStore.getState().occupancy).length===2&&new Set(Object.values(useGarageStore.getState().occupancy)).size===2)
const sedanPosition={...getVehicleRuntime('city-sedan').body!.translation()},coupe=getVehicleRuntime('street-coupe').body!
body.setTranslation(findVehicleExit(ctx,coupe,body as never,VEHICLES[0])!,true);run(3)
await act(()=>{press('KeyE');run(2);press('KeyE',false);press('KeyS');run(150);press('KeyS',false)})
check('driving away clears only the departed bay',!useGarageStore.getState().occupancy[GARAGE.bays[0].id]&&useGarageStore.getState().occupancy[GARAGE.bays[1].id]==='city-sedan')
check('other parked car retains its independent transform',Math.hypot(getVehicleRuntime('city-sedan').body!.translation().x-sedanPosition.x,getVehicleRuntime('city-sedan').body!.translation().z-sedanPosition.z)<.01)
await act(()=>{press('Space');run(120);press('Space',false);press('KeyE');run(2);press('KeyE',false)})
getVehicleRuntime('city-sedan').state.recoveryRevision++;run(12)
check('recovery revision revokes parked status and cannot reconfirm inside the bay',!useGarageStore.getState().occupancy[GARAGE.bays[1].id])
run(150);check('recovered stationary bay cannot spoof a new drive-in',Object.keys(useGarageStore.getState().occupancy).length===0)
check('garage actions preserve both completed mission histories',useMissionStore.getState().progress.completed?.length===2)
for(let i=0;i<3;i++){
 const resources=new Set<THREE.BufferGeometry|THREE.Material>()
 ;(scene as unknown as THREE.Scene).traverse(o=>{if(o instanceof THREE.Mesh&&(o.parent?.name==='garage-service-terminal'||o.name==='garage-parking-markers')){const mesh=o as THREE.Mesh<THREE.BufferGeometry,THREE.Material|THREE.Material[]>;resources.add(mesh.geometry);for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material])resources.add(m)}})
 let released=0;for(const resource of resources)resource.addEventListener('dispose',()=>released++)
 await act(()=>{root.render(render(true,false))});run(2)
 check(`garage remount ${i}: terminal body, occupancy and all six GPU resources release`,garageRuntime.terminal===null&&!useGarageStore.getState().open&&ctx.world.bodies.len()===counts.body-1&&ctx.world.colliders.len()===counts.collider-1&&resources.size===6&&released===6)
 await act(()=>{root.render(render())});run(30)
 check(`garage remount ${i}: callbacks, bodies, colliders and listeners plateau`,ctx.world.bodies.len()===counts.body&&ctx.world.colliders.len()===counts.collider&&ctx.afterStepCallbacks.size===2&&listenerCount()===counts.listeners)
}

check('ambient traffic/pedestrians continue through mission with fixed population',ambientBodies.size===5&&ambientTraffic.get('ambient-coupe')!.distance!==trafficStart)
check('mission adds no bodies, colliders, callbacks or input listeners',ctx.world.bodies.len()===counts.body&&ctx.world.colliders.len()===counts.collider&&ctx.beforeStepCallbacks.size===counts.callback&&listenerCount()===counts.listeners)
check('camera stays finite through walking, driving and dialogues',Number.isFinite((camera as unknown as THREE.Camera).position.length()))
await act(()=>root.unmount())
check('teardown leaves no dialogue/NPC/ambient references or window listeners',!useDialogueStore.getState().active&&npcRegistry.size===0&&ambientBodies.size===0&&listenerCount()===0&&garageRuntime.terminal===null&&!useGarageStore.getState().open&&Object.keys(useGarageStore.getState().occupancy).length===0)
check('session mission completion survives component teardown without restarting',useMissionStore.getState().progress.status==='COMPLETED')
console.log(fails?`${fails} FAILED`:'ALL PASS')
process.exit(fails?1:0)
