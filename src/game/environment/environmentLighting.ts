import { Color, Float32BufferAttribute, MeshStandardMaterial, type BufferGeometry } from 'three'
import { PAL } from './envPalette'

const lamp = new Color(PAL.lampGlow)
const window = new Color(PAL.glassWarm)
const matches = (r: number, g: number, b: number, c: Color) => Math.abs(r - c.r) < 1e-5 && Math.abs(g - c.g) < 1e-5 && Math.abs(b - c.b) < 1e-5

/** Tag existing selected panes and lamp diffusers once; keep geometry and draw calls intact.
 * glassWarm is reserved for windowGrid's deterministic litEvery cells.
 */
export function addNightEmission(geometry: BufferGeometry): void {
  const colors = geometry.getAttribute('color')
  const emission = new Float32Array(colors.count)
  for (let i = 0; i < colors.count; i++) {
    const r = colors.getX(i), g = colors.getY(i), b = colors.getZ(i)
    emission[i] = matches(r, g, b, lamp) ? 2.8 : matches(r, g, b, window) ? 0.85 : 0
  }
  geometry.setAttribute('nightEmission', new Float32BufferAttribute(emission, 1))
}

/** Extends Three's standard lighting/shadow/fog shader with one scalar uniform. */
export function createEnvironmentMaterial() {
  const night = { value: 0 }
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0.02 })
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = night
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nattribute float nightEmission;\nvarying float vNightEmission;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvNightEmission = nightEmission;')
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uNight;\nvarying float vNightEmission;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(1.0, 0.68, 0.28) * vNightEmission * uNight;')
  }
  material.customProgramCacheKey = () => 'vextride-night-emission-v1'
  return { material, night }
}
