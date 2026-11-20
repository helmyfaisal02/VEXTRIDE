/**
 * Character presets and the cosmetic settings a player can change. Pure data
 * and pure functions (no React, no three.js) so they are easy to validate and
 * test. Presets are purely visual: they never affect movement or physics.
 */

export type PresetId = 'urban-blue' | 'street-red' | 'metro-green'
export type TopStyle = 'bomber' | 'hoodie' | 'utility'
export type BottomStyle = 'jeans' | 'cargo' | 'chinos'
export type HeadwearStyle = 'short-hair' | 'beanie' | 'cap'

export interface ColorOption {
  name: string
  hex: string
}

export interface CharacterPreset {
  id: PresetId
  /** Display number, e.g. "01". */
  number: string
  name: string
  summary: string
  top: TopStyle
  bottom: BottomStyle
  headwear: HeadwearStyle
  skin: string
  hair: string
  /** Selectable jacket / hoodie colours. Index 0 is the preset's signature colour. */
  topColors: readonly ColorOption[]
  pants: string
  shoe: string
  sole: string
  /** Fixed headwear colour (`#rrggbb`), or the literal `top` to match the trimmed jacket. */
  headwearColor: string
}

export const TOP_COLOR_COUNT = 4

export const PRESETS: readonly CharacterPreset[] = [
  {
    id: 'urban-blue',
    number: '01',
    name: 'Urban Blue',
    summary: 'Blue bomber jacket, dark jeans, white sneakers',
    top: 'bomber',
    bottom: 'jeans',
    headwear: 'short-hair',
    skin: '#e3b08c',
    hair: '#2a2430',
    topColors: [
      { name: 'Cobalt', hex: '#2f6fd6' },
      { name: 'Teal', hex: '#1f9d8f' },
      { name: 'Amber', hex: '#e0a526' },
      { name: 'Violet', hex: '#7b5cd6' },
    ],
    pants: '#1f2a44',
    shoe: '#f4f4f0',
    sole: '#c9ced6',
    headwearColor: '#2a2430',
  },
  {
    id: 'street-red',
    number: '02',
    name: 'Street Red',
    summary: 'Red hoodie, dark cargo pants, sneakers',
    top: 'hoodie',
    bottom: 'cargo',
    headwear: 'beanie',
    skin: '#a8714f',
    hair: '#1b1a1f',
    topColors: [
      { name: 'Red', hex: '#d6362e' },
      { name: 'Orange', hex: '#ee7a2f' },
      { name: 'Charcoal', hex: '#4a4f5a' },
      { name: 'Pink', hex: '#d9568f' },
    ],
    pants: '#2d3138',
    shoe: '#ece7df',
    sole: '#d6362e',
    headwearColor: '#1f2228',
  },
  {
    id: 'metro-green',
    number: '03',
    name: 'Metro Green',
    summary: 'Green utility jacket, beige pants, dark sneakers',
    top: 'utility',
    bottom: 'chinos',
    headwear: 'cap',
    skin: '#f0c7a0',
    hair: '#4a3324',
    topColors: [
      { name: 'Olive', hex: '#4f8a4b' },
      { name: 'Khaki', hex: '#a39257' },
      { name: 'Navy', hex: '#2f4a73' },
      { name: 'Rust', hex: '#b5602f' },
    ],
    pants: '#cdb994',
    shoe: '#2a2b31',
    sole: '#6b6f78',
    headwearColor: 'top',
  },
]

export interface CharacterSettings {
  name: string
  preset: PresetId
  /** Index into the preset's `topColors`. */
  topColor: number
}

export const DEFAULT_SETTINGS: CharacterSettings = {
  name: 'Player',
  preset: 'urban-blue',
  topColor: 0,
}

export const PRESET_IDS: readonly PresetId[] = PRESETS.map((p) => p.id)

export function isPresetId(value: unknown): value is PresetId {
  return typeof value === 'string' && (PRESET_IDS as readonly string[]).includes(value)
}

export function getPreset(id: PresetId): CharacterPreset {
  return PRESETS.find((p) => p.id === id) ?? PRESETS[0]
}

/* ------------------------------ colour helpers ----------------------------- */

/** Scales a `#rrggbb` colour's brightness. `factor < 1` darkens, `> 1` lightens toward white. */
export function shade(hex: string, factor: number): string {
  const n = Number.parseInt(hex.slice(1), 16)
  const channel = (shift: number) => {
    const v = (n >> shift) & 0xff
    const out = factor <= 1 ? v * factor : v + (255 - v) * (factor - 1)
    return Math.max(0, Math.min(255, Math.round(out)))
  }
  return `#${((channel(16) << 16) | (channel(8) << 8) | channel(0)).toString(16).padStart(6, '0')}`
}

export interface AppearanceColors {
  skin: string
  hair: string
  top: string
  topTrim: string
  pants: string
  pantsTrim: string
  shoe: string
  sole: string
  headwear: string
  eye: string
  light: string
}

export interface Appearance {
  presetId: PresetId
  top: TopStyle
  bottom: BottomStyle
  headwear: HeadwearStyle
  colors: AppearanceColors
}

/** Turns saved settings into the concrete outfit and colours the model renders. */
export function resolveAppearance(settings: CharacterSettings): Appearance {
  const preset = getPreset(settings.preset)
  const option = preset.topColors[settings.topColor] ?? preset.topColors[0]
  const topTrim = shade(option.hex, 0.72)
  return {
    presetId: preset.id,
    top: preset.top,
    bottom: preset.bottom,
    headwear: preset.headwear,
    colors: {
      skin: preset.skin,
      hair: preset.hair,
      top: option.hex,
      topTrim,
      pants: preset.pants,
      pantsTrim: shade(preset.pants, preset.bottom === 'chinos' ? 1.25 : 0.7),
      shoe: preset.shoe,
      sole: preset.sole,
      headwear: preset.headwearColor === 'top' ? topTrim : preset.headwearColor,
      eye: '#1c1c24',
      light: '#eef0f2',
    },
  }
}
