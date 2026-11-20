import { MeshStandardMaterial } from 'three'
import type { AppearanceColors } from './presets'

export type CharacterMaterials = Record<keyof AppearanceColors, MeshStandardMaterial>

const ROUGHNESS: Partial<Record<keyof AppearanceColors, number>> = {
  skin: 0.7,
  shoe: 0.55,
  sole: 0.9,
}

/** Creates one material per colour role. They are reused for the model's whole life. */
export function createCharacterMaterials(colors: AppearanceColors): CharacterMaterials {
  const out = {} as CharacterMaterials
  for (const key of Object.keys(colors) as Array<keyof AppearanceColors>) {
    out[key] = new MeshStandardMaterial({
      color: colors[key],
      roughness: ROUGHNESS[key] ?? 0.82,
      flatShading: true,
    })
  }
  return out
}

/** Recolours existing materials in place, so changing outfit colours allocates nothing. */
export function applyCharacterColors(
  materials: CharacterMaterials,
  colors: AppearanceColors,
): void {
  for (const key of Object.keys(colors) as Array<keyof AppearanceColors>) {
    materials[key].color.set(colors[key])
  }
}

export function disposeCharacterMaterials(materials: CharacterMaterials): void {
  for (const material of Object.values(materials)) material.dispose()
}
