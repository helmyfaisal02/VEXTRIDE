import { awning, door, flatRoof, lbox, rooftopUnit, shell, wallQuad, windowGrid } from './buildingParts'
import { PAL, pick } from './envPalette'
import type { BuildingModel } from './modelTypes'

/** Mid-rise office: stone podium with a glazed lobby, a glass tower with fins, a setback crown and a spire. */
export const officeModel: BuildingModel = (b, f, def) => {
  const W = def.width
  const D = def.depth
  const H = def.height
  const podium = 8
  const glass = pick(PAL.officeGlass, def.variant)
  const frame = pick(PAL.officeFrame, def.variant)
  shell(b, f, W, D, podium, PAL.concrete, PAL.plinth, 0.6)
  // Tower (inset), glass curtain wall.
  const inset = 2
  lbox(b, f, -W / 2 + inset, W / 2 - inset, podium, H, -D / 2 + inset, D / 2 - inset, frame)
  const tw = W - inset * 2
  const td = D - inset * 2
  const floors = Math.floor((H - podium) / 3.6)
  for (const side of ['front', 'back', 'left', 'right'] as const) {
    const horizontal = side === 'front' || side === 'back'
    const len = horizontal ? tw : td
    const cols = Math.max(3, Math.round(len / 3))
    const half = len / 2
    // Wall planes sit at the tower's face, so describe it with its own W/D.
    windowGrid(b, f, side, tw, td, { a0: -half, a1: half, yBase: podium, floorH: 3.6, floors, cols, winW: len / cols - 0.5, winH: 2.5, sill: 0.5, glass, frame: PAL.frameDark, litEvery: 9 })
    // Vertical fins between the windows.
    for (let i = 0; i <= cols; i += 1) {
      const a = -half + (len / cols) * i
      wallQuad(b, f, side, tw, td, a - 0.12, a + 0.12, podium, H, 0.1, PAL.frameWhite)
    }
  }
  // Podium glazing: tall lobby windows on all sides.
  for (const side of ['front', 'back', 'left', 'right'] as const) {
    const len = side === 'front' || side === 'back' ? W : D
    const cols = Math.round(len / 4)
    windowGrid(b, f, side, W, D, { a0: -len / 2, a1: len / 2, yBase: 0, floorH: 4.2, floors: 1, cols, winW: len / cols - 0.7, winH: 3.4, sill: 0.5, glass: PAL.glassDeep, frame: PAL.frameDark, skip: (_, c) => side === 'front' && c === Math.floor(cols / 2) })
    windowGrid(b, f, side, W, D, { a0: -len / 2, a1: len / 2, yBase: 4.8, floorH: 3, floors: 1, cols, winW: len / cols - 0.7, winH: 1.8, sill: 0.4, glass, frame: PAL.frameDark })
  }
  // Entrance: glass doors under a flat canopy.
  lbox(b, f, -4, 4, 4.3, 4.7, D / 2, D / 2 + 3.2, PAL.frameWhite)
  lbox(b, f, -3.7, -3.5, 0.03, 4.3, D / 2 + 2.8, D / 2 + 3.0, PAL.metalDark)
  lbox(b, f, 3.5, 3.7, 0.03, 4.3, D / 2 + 2.8, D / 2 + 3.0, PAL.metalDark)
  door(b, f, W, D, 0, 3.2, 3.2, PAL.glassDeep, PAL.frameDark)
  // Crown: setback block, rooftop equipment and a spire.
  flatRoof(b, f, tw, td, H, 0.6, PAL.roofGrey, frame)
  lbox(b, f, -tw / 2 + 3, tw / 2 - 3, H + 0.1, H + 4, -td / 2 + 3, td / 2 - 3, frame)
  rooftopUnit(b, f, -tw / 4, td / 4, 3, 3, H + 0.1, 1.8, PAL.metal)
  rooftopUnit(b, f, tw / 4, -td / 4, 2.4, 2.4, H + 0.1, 2.6, PAL.metalDark)
  lbox(b, f, -0.2, 0.2, H + 4, H + 12, -0.2, 0.2, PAL.metal)
  return { signs: [{ text: def.name, u: 0, y: 6.4, v: D / 2 + 0.1, width: 9, height: 1.3, board: '#1f2a3a', ink: '#f2f5f8' }] }
}

/** Brick commercial block: shopfront with striped awning, brick upper floors with stone lintels, cornice. */
export const brickModel: BuildingModel = (b, f, def) => {
  const W = def.width
  const D = def.depth
  const H = def.height
  const brick = pick(PAL.brick, def.variant)
  const awn = pick(PAL.awning, def.variant)
  shell(b, f, W, D, H, brick, PAL.plinth, 0.7)
  // Corner pilasters.
  for (const u of [-W / 2, W / 2]) lbox(b, f, u - 0.35, u + 0.35, 0, H, D / 2 - 0.1, D / 2 + 0.15, PAL.brick[2])
  // Shopfront: large panes either side of a central door.
  windowGrid(b, f, 'front', W, D, { a0: -W / 2 + 1, a1: W / 2 - 1, yBase: 0, floorH: 4, floors: 1, cols: 6, winW: (W - 2) / 6 - 0.6, winH: 2.7, sill: 0.8, glass: PAL.glass, frame: PAL.frameWhite, skip: (_, c) => c === 2 || c === 3 })
  door(b, f, W, D, 0, 1.8, 2.6, PAL.door, PAL.frameWhite)
  awning(b, f, -W / 2 + 1.2, W / 2 - 1.2, 3.6, D / 2, 1.8, 0.7, awn)
  // Upper floors with lintels and sills.
  const upper = Math.max(1, Math.floor((H - 4) / 3.2))
  for (const side of ['front', 'back'] as const) {
    windowGrid(b, f, side, W, D, { a0: -W / 2 + 1.5, a1: W / 2 - 1.5, yBase: 4, floorH: 3.2, floors: upper, cols: Math.round(W / 4), winW: 1.5, winH: 1.8, sill: 0.6, glass: PAL.glass, frame: PAL.frameWhite, litEvery: 8 })
  }
  for (const side of ['left', 'right'] as const) {
    windowGrid(b, f, side, W, D, { a0: -D / 2 + 2, a1: D / 2 - 2, yBase: 4, floorH: 3.2, floors: upper, cols: 2, winW: 1.5, winH: 1.8, sill: 0.6, glass: PAL.glass, frame: PAL.frameWhite })
  }
  // Cornice, parapet and rooftop gear.
  lbox(b, f, -W / 2 - 0.3, W / 2 + 0.3, H - 0.4, H + 0.2, -D / 2 - 0.3, D / 2 + 0.3, PAL.concrete)
  flatRoof(b, f, W, D, H + 0.2, 0.6, PAL.roofDark, PAL.concrete)
  rooftopUnit(b, f, W / 4, -1, 2.4, 1.8, H + 0.3, 1.2, PAL.metal)
  rooftopUnit(b, f, -W / 4, 1, 1.6, 1.6, H + 0.3, 2.2, PAL.metalDark)
  return { signs: [{ text: def.name, u: 0, y: 4.65, v: D / 2 + 0.1, width: Math.min(9, W - 4), height: 0.9, board: awn, ink: '#fffaf0' }] }
}

/** Modern convenience store: glazed front, flat overhanging roof with a coloured fascia, rooftop sign. */
export const convenienceModel: BuildingModel = (b, f, def) => {
  const W = def.width
  const D = def.depth
  const H = def.height
  const accent = pick(PAL.awning, def.variant + 1)
  shell(b, f, W, D, H, PAL.frameWhite, PAL.plinth, 0.5)
  lbox(b, f, -W / 2 - 0.4, W / 2 + 0.4, H, H + 0.9, -D / 2 - 0.4, D / 2 + 2.6, accent)
  lbox(b, f, -W / 2 - 0.4, W / 2 + 0.4, H + 0.9, H + 1.05, -D / 2 - 0.4, D / 2 + 2.6, PAL.roofDark)
  for (const u of [-W / 2 + 0.6, W / 2 - 0.6]) lbox(b, f, u - 0.12, u + 0.12, 0, H, D / 2 + 2.3, D / 2 + 2.5, PAL.metalDark)
  const cols = 5
  windowGrid(b, f, 'front', W, D, { a0: -W / 2 + 0.5, a1: W / 2 - 0.5, yBase: 0, floorH: H, floors: 1, cols, winW: (W - 1) / cols - 0.3, winH: 2.7, sill: 0.4, glass: PAL.glass, frame: PAL.frameDark, skip: (_, c) => c === 2 })
  door(b, f, W, D, 0, 2.0, 2.6, PAL.glassDeep, PAL.frameDark)
  windowGrid(b, f, 'left', W, D, { a0: -D / 2 + 2, a1: D / 2 - 2, yBase: 0, floorH: H, floors: 1, cols: 2, winW: 1.6, winH: 1.3, sill: 1.4, glass: PAL.glass, frame: PAL.frameDark })
  rooftopUnit(b, f, W / 4, -D / 4, 2, 1.6, H + 1.05, 1.1, PAL.metal)
  lbox(b, f, -W / 2 + 1, W / 2 - 1, H + 1.05, H + 2.35, D / 2 - 0.1, D / 2 + 0.1, PAL.frameDark)
  return { signs: [{ text: def.name, u: 0, y: H + 1.7, v: D / 2 + 0.15, width: W - 2.4, height: 1.1, board: accent, ink: '#ffffff' }] }
}

/** Vehicle showroom: glass pavilion under a cantilevered roof on slim columns, with flag poles. */
export const showroomModel: BuildingModel = (b, f, def) => {
  const W = def.width
  const D = def.depth
  const H = def.height
  shell(b, f, W, D, H, '#2f343d', PAL.plinth, 0.5)
  // Glazed front and sides, with a solid rear.
  windowGrid(b, f, 'front', W, D, { a0: -W / 2 + 0.6, a1: W / 2 - 0.6, yBase: 0, floorH: H, floors: 1, cols: 5, winW: (W - 1.2) / 5 - 0.25, winH: H - 1.2, sill: 0.3, glass: PAL.glassDeep, frame: PAL.metal, skip: (_, c) => c === 2 })
  door(b, f, W, D, 0, 3.4, 3.2, PAL.glass, PAL.metal)
  for (const side of ['left', 'right'] as const) {
    windowGrid(b, f, side, W, D, { a0: -D / 2 + 1, a1: D / 2 - 1, yBase: 0, floorH: H, floors: 1, cols: 3, winW: (D - 2) / 3 - 0.3, winH: H - 1.4, sill: 0.4, glass: PAL.glassDeep, frame: PAL.metal })
  }
  // Cantilevered roof and columns.
  lbox(b, f, -W / 2 - 0.8, W / 2 + 0.8, H, H + 0.7, -D / 2 - 0.8, D / 2 + 3.4, PAL.frameWhite)
  lbox(b, f, -W / 2 - 0.8, W / 2 + 0.8, H + 0.7, H + 0.85, -D / 2 - 0.8, D / 2 + 3.4, PAL.roofDark)
  const columns = [-W / 2 + 0.4, -W / 4, W / 4, W / 2 - 0.4]
  for (const u of columns) lbox(b, f, u - 0.2, u + 0.2, 0, H, D / 2 + 3.0, D / 2 + 3.4, PAL.metal)
  // Pennant poles with two-sided flags.
  const flags = ['#d6453d', '#f2b83d', '#2f8f83', '#3a62b8']
  for (let i = 0; i < 4; i++) {
    const u = -W / 2 + 2 + (i * (W - 4)) / 3
    lbox(b, f, u - 0.05, u + 0.05, 0, 5.5, D / 2 + 5.0, D / 2 + 5.1, PAL.metal)
    for (const s of [1, -1]) b.quad(f.pt(u, 5.4, D / 2 + 5.05), f.pt(u, 4.2, D / 2 + 5.05), f.pt(u + 1.0, 4.2, D / 2 + 5.05), f.pt(u + 1.0, 5.4, D / 2 + 5.05), f.normal(0, 0, s), flags[i])
  }
  rooftopUnit(b, f, -W / 4, -2, 3, 2, H + 0.85, 1.4, PAL.metal)
  return {
    signs: [{ text: def.name, u: 0, y: H + 1.7, v: D / 2 + 3.5, width: 12, height: 1.6, board: '#14181f', ink: '#ffd34d' }],
    solids: columns.map((u) => ({ u0: u - 0.2, u1: u + 0.2, v0: D / 2 + 3.0, v1: D / 2 + 3.4, y1: H })),
  }
}
