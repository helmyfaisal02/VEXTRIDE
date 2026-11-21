import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Color, CylinderGeometry, ConeGeometry, IcosahedronGeometry, MeshStandardMaterial, Object3D, type InstancedMesh } from 'three'
import { PAL, pick } from './envPalette'
import type { TreeInstance } from './envGeometry'

const dummy = new Object3D()
const tint = new Color()

/** Writes each tree's transform (and leaf tone, for crowns) into an instanced mesh. */
function fillInstances(mesh: InstancedMesh | null, list: readonly TreeInstance[], palette: readonly string[] | null): void {
  if (!mesh) return
  list.forEach((t, i) => {
    dummy.position.set(t.x, t.y, t.z)
    dummy.rotation.set(0, t.rotation, 0)
    dummy.scale.setScalar(t.scale)
    dummy.updateMatrix()
    mesh.setMatrixAt(i, dummy.matrix)
    if (palette) mesh.setColorAt(i, tint.set(pick(palette, t.tone)))
  })
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  mesh.computeBoundingSphere()
}

/** Instanced trees: one trunk mesh for all trees plus one crown mesh per species (3 draw calls for every tree). */
function EnvTreesImpl({ trees }: { trees: readonly TreeInstance[] }) {
  const [assets] = useState(() => {
    const trunk = new CylinderGeometry(0.17, 0.26, 3.2, 6)
    trunk.translate(0, 1.6, 0)
    const round = new IcosahedronGeometry(2.1, 0)
    round.translate(0, 4.3, 0)
    const conifer = new ConeGeometry(1.7, 7, 7)
    conifer.translate(0, 5.0, 0)
    return {
      trunk,
      round,
      conifer,
      woodMaterial: new MeshStandardMaterial({ color: PAL.trunk, roughness: 0.95, flatShading: true }),
      leafMaterial: new MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, flatShading: true }),
    }
  })
  const trunks = useRef<InstancedMesh>(null)
  const rounds = useRef<InstancedMesh>(null)
  const conifers = useRef<InstancedMesh>(null)
  const roundList = trees.filter((t) => t.kind === 'tree-round')
  const coniferList = trees.filter((t) => t.kind === 'tree-conifer')

  useLayoutEffect(() => {
    fillInstances(trunks.current, trees, null)
    fillInstances(rounds.current, roundList, PAL.leaf)
    fillInstances(conifers.current, coniferList, PAL.conifer)
  }, [trees, roundList, coniferList])

  // The instanced meshes own their instance buffers. These supplied assets
  // are shared by the meshes and belong to this component.
  useEffect(() => () => {
    assets.trunk.dispose()
    assets.round.dispose()
    assets.conifer.dispose()
    assets.woodMaterial.dispose()
    assets.leafMaterial.dispose()
  }, [assets])

  return (
    <group name="city-trees">
      <instancedMesh ref={trunks} args={[assets.trunk, assets.woodMaterial, trees.length]} castShadow />
      <instancedMesh ref={rounds} args={[assets.round, assets.leafMaterial, roundList.length]} castShadow receiveShadow />
      <instancedMesh ref={conifers} args={[assets.conifer, assets.leafMaterial, coniferList.length]} castShadow receiveShadow />
    </group>
  )
}

export const EnvTrees = memo(EnvTreesImpl)
