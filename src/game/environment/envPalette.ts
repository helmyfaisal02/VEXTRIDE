/**
 * Shared colour palette for every building and prop. One cohesive stylised
 * look: warm brick and stucco, cool glass, saturated accents on awnings and
 * signs. All geometry uses vertex colours from here, so materials are shared.
 */
export const PAL = {
  glass: '#86b9d8',
  glassDeep: '#3f6a8a',
  glassWarm: '#f1dca4',
  frameWhite: '#f4f2ec',
  frameDark: '#2f3238',
  door: '#3b3f48',
  doorWood: '#7a4f33',
  plinth: '#6e6c67',
  concrete: '#bcbab3',
  concreteDark: '#8c8b86',
  asphaltPad: '#40434a',
  driveway: '#a7a49b',
  lawn: '#79b05f',
  lawnDark: '#5f9a4d',
  promenade: '#d2c6ad',
  roofDark: '#4a4e57',
  roofRed: '#a34c3a',
  roofGrey: '#70747c',
  roofGreen: '#4d7a5a',
  metal: '#aab3bd',
  metalDark: '#6a727c',
  steel: '#8e99a6',
  paintWhite: '#f4f3ee',
  paintYellow: '#f0c33c',
  hazard: '#e6a321',
  wood: '#8a5e3b',
  woodLight: '#b8885a',
  trunk: '#6b4a30',
  leaf: ['#4f9a4a', '#5aa84f', '#3f8a45', '#6bb35a'] as readonly string[],
  conifer: ['#2f6f4a', '#2a6444', '#37784f'] as readonly string[],
  planterSoil: '#4b3a2c',
  planterShell: '#c9c3b6',
  flower: ['#e66b8b', '#f2b83d', '#e8573f', '#a678d6'] as readonly string[],
  lampPole: '#3b4048',
  lampGlow: '#fff2c4',
  stopRed: '#c93a32',
  signPole: '#8b939c',
  brick: ['#a4563f', '#b5694b', '#93503b'] as readonly string[],
  stucco: ['#ead9b8', '#d7e3d0', '#f0cba9', '#c7d7e8'] as readonly string[],
  houseRoof: ['#8a4535', '#5b6470', '#4e6b57', '#7a5a43'] as readonly string[],
  awning: ['#d6453d', '#2f8f83', '#e8a838', '#3a62b8'] as readonly string[],
  container: ['#c8553d', '#3b6ea5', '#d9a441', '#4f8a6b', '#8a5a9c'] as readonly string[],
  officeGlass: ['#7aa9c9', '#8fb7c4', '#9ab3d1'] as readonly string[],
  officeFrame: ['#c4c9cf', '#a9b1b9'] as readonly string[],
  warehouseWall: ['#c9ccd1', '#b9c4cf', '#d0c8b8'] as readonly string[],
  warehouseStripe: ['#b0b4ba', '#a3b0be', '#bdb3a0'] as readonly string[],
  garageWall: ['#d9d4c8', '#c2c9d1'] as readonly string[],
} as const

export function pick<T>(list: readonly T[], variant: number): T {
  return list[((variant % list.length) + list.length) % list.length]
}
