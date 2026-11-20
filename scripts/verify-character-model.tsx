/**
 * Headless check of the procedural character models: mounts each preset in a
 * real React Three Fiber root (with a stub renderer, so no WebGL is needed)
 * and verifies the rig, proportions and joint layout. Run with
 * `bun run verify:model`.
 */
import { createElement } from 'react'
import { _roots, act as rawAct, createRoot, extend } from '@react-three/fiber'
import * as THREE from 'three'
import { Box3, Mesh, MeshStandardMaterial, Vector3, type Group, type Object3D } from 'three'
import { CharacterModel } from '../src/game/character/CharacterModel'
import { createCharacterRig, type CharacterRig } from '../src/game/character/characterRig'
import { PRESETS, resolveAppearance } from '../src/game/character/presets'

/** React's `act`, typed: flushes renders and effects inside the callback. */
const act = rawAct as unknown as (callback: () => void | Promise<void>) => Promise<void>

// Register three.js classes for JSX (the browser entry does this itself).
extend(THREE)
// Lets React flush renders synchronously inside `act`.
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let fails = 0
const check = (name: string, ok: boolean, info = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${info}`)
  if (!ok) fails++
}

const noop = () => {}
const makeCanvas = () => ({
  style: {},
  width: 800,
  height: 600,
  clientWidth: 800,
  clientHeight: 600,
  addEventListener: noop,
  removeEventListener: noop,
  getContext: () => null,
}) as unknown as HTMLCanvasElement
const makeRenderer = (canvas: HTMLCanvasElement) => ({
  domElement: canvas,
  render: noop,
  setSize: noop,
  setPixelRatio: noop,
  setClearColor: noop,
  dispose: noop,
  forceContextLoss: noop,
  shadowMap: {},
  info: {},
  xr: { addEventListener: noop, removeEventListener: noop, setAnimationLoop: noop },
  setAnimationLoop: noop,
  getContext: () => ({}),
})

const JOINTS = ['hips', 'torso', 'head', 'armL', 'armR', 'elbowL', 'elbowR', 'legL', 'legR', 'kneeL', 'kneeR'] as const

async function mount(presetIndex: number, topColor = 0) {
  const canvas = makeCanvas()
  const root = createRoot(canvas)
  root.configure({ gl: makeRenderer(canvas) as never, frameloop: 'never', size: { width: 800, height: 600, top: 0, left: 0 } })
  const rig = createCharacterRig()
  const appearance = resolveAppearance({ name: 'Tester', preset: PRESETS[presetIndex].id, topColor })
  await act(() => {
    root.render(createElement(CharacterModel, { rig, appearance }))
  })
  const state = _roots.get(canvas)!.store.getState()
  state.scene.updateMatrixWorld(true)
  return { root, rig, scene: state.scene as Object3D }
}

function jointLayout(rig: CharacterRig): string {
  return JOINTS.map((j) => {
    const g = rig[j].current as Group
    const p = new Vector3()
    g.getWorldPosition(p)
    return `${j}:${p.x.toFixed(3)},${p.y.toFixed(3)},${p.z.toFixed(3)}`
  }).join(' ')
}

const layouts: string[] = []
for (let i = 0; i < PRESETS.length; i++) {
  const { root, rig, scene } = await mount(i)
  const name = PRESETS[i].name
  check(`${name}: all 11 animation joints attached`, JOINTS.every((j) => rig[j].current !== null))
  const box = new Box3().setFromObject(scene)
  const size = box.getSize(new Vector3())
  check(`${name}: height ~1.8 m`, size.y > 1.74 && size.y < 1.95, `height=${size.y.toFixed(3)} minY=${box.min.y.toFixed(3)}`)
  check(`${name}: feet at ground`, Math.abs(box.min.y) < 0.02)
  check(`${name}: symmetric and slim`, Math.abs(box.min.x + box.max.x) < 0.03 && size.x < 0.9, `width=${size.x.toFixed(3)}`)
  let meshes = 0
  scene.traverse((o) => { if ((o as Mesh).isMesh) meshes++ })
  check(`${name}: reasonable mesh count (<= 80)`, meshes > 20 && meshes <= 80, `${meshes} meshes`)
  layouts.push(jointLayout(rig))
  await act(() => root.unmount())
}
check('all presets share identical joint layout (animation-compatible)', layouts.every((l) => l === layouts[0]))

{ // clothing colour changes recolour materials, not the rig
  const a = await mount(0, 0)
  const b = await mount(0, 2)
  const topColor = (scene: Object3D) => {
    const colors = new Set<string>()
    scene.traverse((o) => { const m = (o as Mesh).material; if (m instanceof MeshStandardMaterial) colors.add(m.color.getHexString()) })
    return colors
  }
  const ca = topColor(a.scene), cb = topColor(b.scene)
  check('clothing colour option changes the rendered colours', ca.has('2f6fd6') && !cb.has('2f6fd6') && cb.has('e0a526'))
  await act(() => { a.root.unmount(); b.root.unmount() })
}

{ // Live switching on one mounted model: joints keep their identity, colours update in place.
  const canvas = makeCanvas()
  const root = createRoot(canvas)
  root.configure({ gl: makeRenderer(canvas) as never, frameloop: 'never', size: { width: 800, height: 600, top: 0, left: 0 } })
  const rig = createCharacterRig()
  const show = async (preset: number, topColor: number) => {
    const appearance = resolveAppearance({ name: 'Tester', preset: PRESETS[preset].id, topColor })
    await act(() => {
      root.render(createElement(CharacterModel, { rig, appearance }))
    })
  }
  await show(0, 0)
  const before = JOINTS.map((j) => rig[j].current)
  const scene = _roots.get(canvas)!.store.getState().scene
  const meshCount = () => { let n = 0; scene.traverse((o) => { if ((o as Mesh).isMesh) n++ }); return n }
  const n0 = meshCount()
  await show(1, 0)
  const afterPreset = JOINTS.map((j) => rig[j].current)
  check('switching preset keeps the same joint objects (no rig rebuild)', before.every((g, i) => g !== null && g === afterPreset[i]))
  check('switching preset swaps the outfit geometry', meshCount() !== n0, `${n0} -> ${meshCount()} meshes`)
  const colorsOf = () => { const c = new Set<string>(); scene.traverse((o) => { const m = (o as Mesh).material; if (m instanceof MeshStandardMaterial) c.add(m.color.getHexString()) }); return c }
  check('Street Red uses its red hoodie', colorsOf().has('d6362e'))
  await show(1, 2)
  check('colour swatch recolours in place', colorsOf().has('4a4f5a'))
  await act(() => root.unmount())
}

console.log(fails === 0 ? 'ALL PASS' : `${fails} FAILED`)
process.exit(fails ? 1 : 0)
