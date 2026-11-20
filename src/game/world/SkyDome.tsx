import { memo, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BackSide, Color, Vector3, type Mesh } from 'three'
import { COLORS, SUN_POSITION } from '../shared/constants'
import { worldLighting } from './dayNight'

const vertexShader = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uMid;
  uniform vec3 uHorizon;
  uniform vec3 uSunColor;
  uniform vec3 uSunDir;
  uniform float uNight;
  uniform float uSunVisibility;
  varying vec3 vDir;
  void main() {
    vec3 dir = normalize(vDir);
    float h = clamp(dir.y, 0.0, 1.0);
    vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.22, h));
    col = mix(col, uTop, smoothstep(0.18, 0.8, h));
    float sunAmount = max(dot(dir, normalize(uSunDir)), 0.0);
    col += uSunColor * (pow(sunAmount, 700.0) * 1.6 + pow(sunAmount, 12.0) * 0.18) * uSunVisibility;
    // Sparse 3D direction-space cells avoid a longitude seam or a texture.
    vec3 cell = floor(dir * 220.0);
    float hash = fract(sin(dot(cell, vec3(127.1, 311.7, 74.7))) * 43758.5453);
    float star = smoothstep(0.996, 0.9995, hash);
    col += vec3(0.65, 0.76, 1.0) * star * uNight * smoothstep(0.05, 0.35, dir.y) * 0.45;
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

/** Gradient sky dome with a sun glow. One draw call, no textures. */
function SkyDomeImpl() {
  const uniforms = useMemo(
    () => ({
      uTop: { value: new Color(COLORS.skyTop) },
      uMid: { value: new Color(COLORS.skyMid) },
      uHorizon: { value: new Color(COLORS.horizon) },
      uSunColor: { value: new Color(COLORS.sun) },
      uSunDir: { value: new Vector3(...SUN_POSITION).normalize() },
      uNight: { value: 0 },
      uSunVisibility: { value: 1 },
    }),
    [],
  )
  const mutableUniforms = useRef(uniforms)
  const dome = useRef<Mesh>(null)

  useFrame(({ camera }) => {
    const uniforms = mutableUniforms.current
    uniforms.uTop.value.copy(worldLighting.top)
    uniforms.uMid.value.copy(worldLighting.mid)
    uniforms.uHorizon.value.copy(worldLighting.horizon)
    uniforms.uSunColor.value.copy(worldLighting.sun)
    uniforms.uSunDir.value.copy(worldLighting.sunDirection)
    uniforms.uNight.value = worldLighting.night
    uniforms.uSunVisibility.value = Math.min(1, Math.max(0, worldLighting.sunDirection.y * 12 + 0.5))
    // Follow the viewer so the gradient/glow stays aligned with the light across the city.
    if (dome.current) dome.current.position.copy(camera.position)
  })

  return (
    <mesh ref={dome} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[800, 32, 16]} />
      <shaderMaterial
        side={BackSide}
        depthWrite={false}
        fog={false}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
      />
    </mesh>
  )
}

export const SkyDome = memo(SkyDomeImpl)
