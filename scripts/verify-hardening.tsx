import assert from 'node:assert/strict'
import { act as rawAct, createRoot, extend, useThree } from '@react-three/fiber'
import RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import { useEffect } from 'react'
import { EnvTrees } from '../src/game/environment/EnvTrees'
import type { TreeInstance } from '../src/game/environment/envGeometry'
import { processInteraction } from '../src/game/interactions/interactionCoordinator'
import { inputState } from '../src/game/input/inputState'
import { useCharacterStore } from '../src/game/state/characterStore'
import { useVehicleStore, vehicleRuntime } from '../src/game/vehicles/vehicleState'
import { fleetFixture } from './vehicle-fleet-fixture'

await RAPIER.init()
useCharacterStore.getState().setName('Hardening')
useCharacterStore.getState().confirm()

const fleet = fleetFixture(true)
const car = fleet.entry('street-coupe').body
const position = car.translation()
const player = fleet.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(position.x - 1.8, position.y + .4, position.z))
fleet.world.createCollider(RAPIER.ColliderDesc.capsule(.35, .28), player)
fleet.world.step()
vehicleRuntime.pedestrian = player
const actualCast = fleet.world.castRay.bind(fleet.world)
let casts = 0
fleet.world.castRay = (...args) => {
  casts++
  return actualCast(...args)
}

processInteraction(fleet.physics)
assert.equal(casts, 1)
assert.match(useVehicleStore.getState().hint, /Street Coupe/)
casts = 0
const wall = fleet.world.createCollider(RAPIER.ColliderDesc.cuboid(.1, 1, .5).setTranslation(position.x - .9, position.y + .4, position.z))
fleet.world.step()
inputState.interactQueued = true
processInteraction(fleet.physics)
assert.equal(casts, 1)
assert.equal(useVehicleStore.getState().driving, false)
assert.equal(inputState.interactQueued, false)
fleet.world.removeCollider(wall, false)
fleet.world.step()
casts = 0
inputState.interactQueued = true
processInteraction(fleet.physics)
assert.equal(casts, 1)
assert.equal(useVehicleStore.getState().activeVehicleId, 'street-coupe')
assert.equal(player.isEnabled(), false)
vehicleRuntime.pedestrian = null
fleet.free()
console.log('PASS  One eligibility ray per coordinator step, with immediate obstruction checks and unchanged E entry')

const act = rawAct as unknown as (fn: () => void | Promise<void>) => Promise<void>
extend(THREE)
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
const noop = () => {}
const canvas = {
  style: {}, ownerDocument: { addEventListener: noop, removeEventListener: noop },
  width: 800, height: 600, clientWidth: 800, clientHeight: 600,
  addEventListener: noop, removeEventListener: noop, getContext: () => null,
} as unknown as HTMLCanvasElement
const renderer = {
  domElement: canvas, render: noop, setSize: noop, setPixelRatio: noop, setClearColor: noop, dispose: noop,
  forceContextLoss: noop, shadowMap: {}, info: {}, xr: { addEventListener: noop, removeEventListener: noop },
  setAnimationLoop: noop, getContext: () => ({}),
}
const treeInstances: TreeInstance[] = [
  { kind: 'tree-round', x: 3, y: 0, z: 6, scale: 1, rotation: 0, tone: 0 },
  { kind: 'tree-conifer', x: 6, y: 0, z: 3, scale: 1, rotation: 0, tone: 0 },
]
let scene: THREE.Scene | undefined
function CaptureScene() {
  const current = useThree(value => value.scene)
  useEffect(() => { scene = current }, [current])
  return null
}

const root = createRoot(canvas)
root.configure({ gl: renderer as never, frameloop: 'never', size: { width: 800, height: 600, top: 0, left: 0 } })
const disposedBefore = new Set<THREE.BufferGeometry | THREE.Material>()
for (let cycle = 0; cycle < 3; cycle++) {
  await act(() => { root.render(<><EnvTrees trees={treeInstances} /><CaptureScene /></>) })
  const group = scene?.getObjectByName('city-trees')
  assert.ok(group)
  const meshes = group.children as THREE.InstancedMesh<THREE.BufferGeometry, THREE.Material>[]
  assert.deepEqual(meshes.map(mesh => mesh.count), [2, 1, 1])
  assert.equal(meshes[1].material, meshes[2].material)
  const owned = new Set(meshes.flatMap(mesh => [mesh.geometry, mesh.material]))
  assert.equal(owned.size, 5)
  const disposed = new Map<THREE.BufferGeometry | THREE.Material, number>()
  for (const asset of owned) {
    assert.ok(!disposedBefore.has(asset))
    asset.addEventListener('dispose', () => disposed.set(asset, (disposed.get(asset) ?? 0) + 1))
  }
  await act(() => { root.render(<CaptureScene />) })
  assert.equal(scene?.getObjectByName('city-trees'), undefined)
  for (const asset of owned) {
    assert.equal(disposed.get(asset), 1)
    disposedBefore.add(asset)
  }
}
await act(() => root.unmount())
console.log('PASS  Three tree remounts reuse leaf materials while mounted and dispose all owned assets once per teardown')
