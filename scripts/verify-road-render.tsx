import assert from 'node:assert/strict'
import { Suspense, useEffect } from 'react'
import { createRoot, extend, act as rawAct, useThree } from '@react-three/fiber'
import { Physics, useRapier } from '@react-three/rapier'
import * as THREE from 'three'
import { Ground } from '../src/game/world/Ground'

const act = rawAct as unknown as (callback: () => void | Promise<void>) => Promise<void>
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
extend(THREE)

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
const root = createRoot(canvas)
root.configure({ gl: renderer as never, frameloop: 'never', size: { width: 800, height: 600, top: 0, left: 0 } })

let captured: { scene: THREE.Scene; physics: ReturnType<typeof useRapier> } | undefined
function Capture() {
  const scene = useThree(state => state.scene)
  const physics = useRapier()
  useEffect(() => { captured = { scene, physics } }, [scene, physics])
  return null
}

try {
  await act(() => {
    root.render(<Suspense fallback={null}><Physics><Ground /><Capture /></Physics></Suspense>)
  })
  for (let i = 0; i < 40 && !captured; i++) {
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)) })
  }
  assert.ok(captured, 'Ground and Rapier mounted')
  const { scene, physics } = captured
  const meshes: THREE.Mesh<THREE.PlaneGeometry, THREE.Material>[] = []
  scene.traverse(child => {
    const mesh = child as THREE.Mesh<THREE.PlaneGeometry, THREE.Material>
    if (mesh.isMesh && mesh.geometry.type === 'PlaneGeometry') meshes.push(mesh)
  })
  const grid = meshes.find(mesh => (mesh.material as THREE.ShaderMaterial).isShaderMaterial) as
    THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> | undefined
  const ground = meshes.find(mesh => mesh.material.type === 'MeshStandardMaterial')
  assert.ok(grid && ground, `Expected grid and ground plane, got ${meshes.map(mesh => mesh.material.type).join(', ')}`)
  scene.updateMatrixWorld(true)

  // Model the Grid vertex shader's xzy swizzle and expansion using its live
  // geometry and uniforms. A finite source quad alone is insufficient.
  const uniforms: Record<string, { value: unknown }> = grid.material.uniforms
  const fade = uniforms.fadeDistance.value
  assert.ok(typeof fade === 'number')
  const expansion = uniforms.infiniteGrid.value === true ? 1 + fade : 1
  const result = new THREE.Box3()
  const positions = grid.geometry.getAttribute('position')
  for (let i = 0; i < positions.count; i++) {
    const vertex = new THREE.Vector3(positions.getX(i), positions.getZ(i), positions.getY(i))
    result.expandByPoint(vertex.multiplyScalar(expansion).applyMatrix4(grid.matrixWorld))
  }
  const terrain = new THREE.Box3().setFromObject(ground)
  for (const axis of ['x', 'z'] as const) {
    assert.ok(Math.abs(result.min[axis] - terrain.min[axis]) < 1e-6, `Grid extends past terrain on ${axis} minimum`)
    assert.ok(Math.abs(result.max[axis] - terrain.max[axis]) < 1e-6, `Grid extends past terrain on ${axis} maximum`)
  }
  assert.ok(result.min.y > terrain.max.y && result.max.y < .03, 'Grid stays above its ground slab and below the city road')

  assert.equal(physics.world.bodies.len(), 1)
  assert.equal(physics.world.colliders.len(), 1)
  physics.world.step()
  const hit = physics.world.castRay(new physics.rapier.Ray({ x: 260, y: 2, z: 0 }, { x: 0, y: -1, z: 0 }), 3, true)
  assert.ok(hit && Math.abs(hit.timeOfImpact - 2) < 1e-6, 'Demo yard still sits on the original terrain slab')
  console.log('PASS  Actual grid shader footprint matches terrain bounds without undersurface overflow, and Rapier ground stays intact')
} finally {
  await act(() => root.unmount())
}
