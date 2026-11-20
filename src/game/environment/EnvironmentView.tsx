import { memo, useEffect, useRef, useState } from 'react'
import { MeshStandardMaterial } from 'three'
import { useFrame } from '@react-three/fiber'
import { worldLighting } from '../world/dayNight'
import { createEnvironmentMaterial } from './environmentLighting'
import { StreetLights } from './StreetLights'
import { buildEnvironmentGeometry } from './envGeometry'
import { EnvTrees } from './EnvTrees'
import { createSignTexture } from './signTexture'

/**
 * The visible environment: six merged district meshes (buildings and props),
 * two paint layers, one sign mesh and instanced trees. About a dozen draw
 * calls in total. Geometry and materials are built once and shared.
 */
function EnvironmentViewImpl() {
  const [assets] = useState(() => {
    const geometry = buildEnvironmentGeometry()
    const texture = createSignTexture(geometry.signs.entries)
    const lighting = createEnvironmentMaterial()
    const paint = (factor: number) => new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: factor, polygonOffsetUnits: factor })
    return {
      geometry,
      texture,
      solid: lighting.material,
      night: lighting.night,
      paintBase: paint(-1),
      paintLines: paint(-3),
      sign: new MeshStandardMaterial({ map: texture, color: texture ? '#ffffff' : '#555a63', roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    }
  })

  const night = useRef(assets.night)
  useFrame(() => { night.current.value = worldLighting.night })

  useEffect(
    () => () => {
      for (const c of assets.geometry.chunks) c.geometry.dispose()
      assets.geometry.paintBase.dispose()
      assets.geometry.paintLines.dispose()
      assets.geometry.signs.geometry.dispose()
      assets.texture?.dispose()
      for (const m of [assets.solid, assets.paintBase, assets.paintLines, assets.sign]) m.dispose()
    },
    [assets],
  )

  return (
    <group name="city-environment">
      {assets.geometry.chunks.map((c) => (
        <mesh key={c.district} name={`env-${c.district}`} geometry={c.geometry} material={assets.solid} castShadow receiveShadow />
      ))}
      <mesh name="env-paint-base" geometry={assets.geometry.paintBase} material={assets.paintBase} receiveShadow renderOrder={1} />
      <mesh name="env-paint-lines" geometry={assets.geometry.paintLines} material={assets.paintLines} receiveShadow renderOrder={2} />
      <mesh name="env-signs" geometry={assets.geometry.signs.geometry} material={assets.sign} renderOrder={3} />
      <EnvTrees trees={assets.geometry.trees} />
      <StreetLights />
    </group>
  )
}

export const EnvironmentView = memo(EnvironmentViewImpl)
