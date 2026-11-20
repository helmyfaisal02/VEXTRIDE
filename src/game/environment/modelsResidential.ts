import { awning, door, flatRoof, gableRoof, lbox, rooftopUnit, shell, windowGrid } from './buildingParts'
import { PAL, pick } from './envPalette'
import type { BuildingModel } from './modelTypes'

/** Low-rise apartment block: balconies on every upper floor, a canopied entrance, flat roof with a stair housing. */
export const apartmentModel: BuildingModel = (b, f, def) => {
  const W = def.width
  const D = def.depth
  const H = def.height
  const wall = pick(PAL.stucco, def.variant)
  const floors = 4
  const floorH = H / floors
  shell(b, f, W, D, H, wall, PAL.plinth, 0.8)
  // An odd column count puts a column on the centreline, above the entrance.
  const cols = 2 * Math.floor(W / 10) + 1
  const mid = Math.floor(cols / 2)
  windowGrid(b, f, 'front', W, D, { a0: -W / 2 + 1, a1: W / 2 - 1, yBase: 0, floorH, floors, cols, winW: 1.6, winH: 1.9, sill: 0.8, glass: PAL.glass, frame: PAL.frameWhite, litEvery: 7, skip: (fl, c) => fl === 0 && c === mid })
  windowGrid(b, f, 'back', W, D, { a0: -W / 2 + 1, a1: W / 2 - 1, yBase: 0, floorH, floors, cols, winW: 1.6, winH: 1.9, sill: 0.8, glass: PAL.glass, frame: PAL.frameWhite })
  for (const side of ['left', 'right'] as const) {
    windowGrid(b, f, side, W, D, { a0: -D / 2 + 2, a1: D / 2 - 2, yBase: 0, floorH, floors, cols: 2, winW: 1.5, winH: 1.9, sill: 0.8, glass: PAL.glass, frame: PAL.frameWhite })
  }
  // Balconies: slab, front rail and end rails, one per window above the ground floor.
  const cell = (W - 2) / cols
  for (let fl = 1; fl < floors; fl++) {
    for (let c = 0; c < cols; c++) {
      const u = -W / 2 + 1 + cell * (c + 0.5)
      const y = fl * floorH
      lbox(b, f, u - 1.3, u + 1.3, y - 0.05, y + 0.15, D / 2, D / 2 + 1.3, PAL.concrete)
      lbox(b, f, u - 1.3, u + 1.3, y + 0.15, y + 1.05, D / 2 + 1.24, D / 2 + 1.3, PAL.frameDark)
      lbox(b, f, u - 1.3, u - 1.24, y + 0.15, y + 1.05, D / 2, D / 2 + 1.24, PAL.frameDark)
      lbox(b, f, u + 1.24, u + 1.3, y + 0.15, y + 1.05, D / 2, D / 2 + 1.24, PAL.frameDark)
    }
  }
  // Entrance canopy and door.
  door(b, f, W, D, 0, 2.2, 2.6, PAL.door, PAL.frameWhite)
  awning(b, f, -2.4, 2.4, 3.3, D / 2, 1.6, 0.3, pick(PAL.awning, def.variant))
  lbox(b, f, -1.6, 1.6, 0, 0.15, D / 2, D / 2 + 0.9, PAL.concrete)
  flatRoof(b, f, W, D, H, 0.7, PAL.roofDark, wall)
  rooftopUnit(b, f, W / 3, 0, 3.2, 3.2, H + 0.1, 2.6, wall)
  rooftopUnit(b, f, -W / 4, -D / 4, 2.2, 2.2, H + 0.1, 1.6, PAL.metal)
  return { signs: [{ text: def.name, u: 0, y: 3.95, v: D / 2 + 0.1, width: 5, height: 0.7, board: '#2c3a4d', ink: '#f4f1e8' }] }
}

/** Small suburban house: gable roof, front porch with posts, shuttered windows, chimney. */
export const houseModel: BuildingModel = (b, f, def) => {
  const W = def.width
  const D = def.depth
  const H = def.height
  const wall = pick(PAL.stucco, def.variant)
  const roof = pick(PAL.houseRoof, def.variant)
  shell(b, f, W, D, H, wall, PAL.plinth, 0.5)
  gableRoof(b, f, { u0: -W / 2, u1: W / 2, v0: -D / 2, v1: D / 2, yEave: H, rise: 2.6, overhang: 0.5, ridge: def.variant % 2 === 0 ? 'u' : 'v', roof, gable: wall })
  // Porch: slab, two posts and a low roof.
  lbox(b, f, -2.4, 2.4, 0, 0.3, D / 2, D / 2 + 2.2, PAL.concrete)
  for (const u of [-2.2, 2.2]) lbox(b, f, u - 0.1, u + 0.1, 0.3, 2.8, D / 2 + 1.9, D / 2 + 2.1, PAL.frameWhite)
  lbox(b, f, -2.7, 2.7, 2.8, 3.0, D / 2 - 0.1, D / 2 + 2.4, roof)
  door(b, f, W, D, 0, 1.1, 2.2, PAL.doorWood, PAL.frameWhite)
  windowGrid(b, f, 'front', W, D, { a0: -W / 2 + 0.5, a1: W / 2 - 0.5, yBase: 0, floorH: H, floors: 1, cols: 3, winW: 1.3, winH: 1.4, sill: 0.9, glass: PAL.glass, frame: PAL.frameWhite, skip: (_, c) => c === 1 })
  for (const u of [-W / 3 - 0.9, -W / 3 + 0.9, W / 3 - 0.9, W / 3 + 0.9]) lbox(b, f, u - 0.18, u + 0.18, 0.7, 2.4, D / 2, D / 2 + 0.08, pick(PAL.awning, def.variant + 2))
  windowGrid(b, f, 'back', W, D, { a0: -W / 2 + 0.5, a1: W / 2 - 0.5, yBase: 0, floorH: H, floors: 1, cols: 2, winW: 1.3, winH: 1.4, sill: 0.9, glass: PAL.glass, frame: PAL.frameWhite })
  for (const side of ['left', 'right'] as const) {
    windowGrid(b, f, side, W, D, { a0: -D / 2 + 0.5, a1: D / 2 - 0.5, yBase: 0, floorH: H, floors: 1, cols: 2, winW: 1.2, winH: 1.4, sill: 0.9, glass: PAL.glass, frame: PAL.frameWhite })
  }
  lbox(b, f, W / 4 - 0.45, W / 4 + 0.45, 1.5, H + 4.1, -0.45, 0.45, PAL.brick[1])
  return { signs: [] }
}
