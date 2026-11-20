import { memo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Object3D, type AmbientLight, type DirectionalLight, type Fog, type HemisphereLight } from 'three'
import { playerState } from '../character'
import { COLORS, SUN_POSITION } from '../shared/constants'
import { worldLighting } from './dayNight'

/** The shadow map follows the player in steps of this many metres, so shadows do not shimmer. */
const SHADOW_SNAP = 2

/**
 * Hemisphere + ambient fill, one shadow-casting directional sun, and fog sized
 * for the city. The sun's shadow box (about 140 m wide) is re-centred on the
 * player, so shadows stay sharp anywhere in the 340 m city.
 */
function LightingImpl() {
  const light = useRef<DirectionalLight>(null)
  const ambient = useRef<AmbientLight>(null)
  const hemisphere = useRef<HemisphereLight>(null)
  const fog = useRef<Fog>(null)
  const [target] = useState(() => new Object3D())

  useFrame(() => {
    const sun = light.current
    if (!sun) return
    const x = Math.round(playerState.position.x / SHADOW_SNAP) * SHADOW_SNAP
    const z = Math.round(playerState.position.z / SHADOW_SNAP) * SHADOW_SNAP
    target.position.set(x, 0, z)
    target.updateMatrixWorld()
    sun.position.copy(worldLighting.sunDirection).multiplyScalar(100)
    sun.position.x += x
    sun.position.z += z
    sun.color.copy(worldLighting.sun)
    sun.intensity = worldLighting.sunIntensity
    if (ambient.current) ambient.current.intensity = worldLighting.ambientIntensity
    if (hemisphere.current) {
      hemisphere.current.color.copy(worldLighting.mid)
      hemisphere.current.intensity = worldLighting.hemisphereIntensity
    }
    if (fog.current) fog.current.color.copy(worldLighting.horizon)
  })

  return (
    <>
      <fog ref={fog} attach="fog" args={[COLORS.horizon, 150, 540]} />
      <ambientLight ref={ambient} intensity={0.35} />
      <hemisphereLight ref={hemisphere} args={[COLORS.skyMid, COLORS.ground, 0.55]} />
      <primitive object={target} />
      <directionalLight
        ref={light}
        target={target}
        position={SUN_POSITION}
        color={COLORS.sun}
        intensity={2.4}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={1}
        shadow-camera-far={220}
        shadow-camera-left={-70}
        shadow-camera-right={70}
        shadow-camera-top={70}
        shadow-camera-bottom={-70}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
      />
    </>
  )
}

export const Lighting = memo(LightingImpl)
