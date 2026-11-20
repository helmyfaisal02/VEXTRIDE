import { awning, door, flatRoof, gableRoof, lbox, rooftopUnit, shell, wallQuad, windowGrid } from './buildingParts'
import { PAL, pick } from './envPalette'
import type { BuildingModel, LocalSolid } from './modelTypes'

/** Roll-up door: panel with horizontal slat lines and a frame, on the front wall. */
function rollUp(b: Parameters<BuildingModel>[0], f: Parameters<BuildingModel>[1], W: number, D: number, u: number, w: number, h: number, panel: string): void {
  wallQuad(b, f, 'front', W, D, u - w / 2 - 0.25, u + w / 2 + 0.25, 0, h + 0.25, 0.03, PAL.frameDark)
  wallQuad(b, f, 'front', W, D, u - w / 2, u + w / 2, 0, h, 0.05, panel)
  for (let y = 0.5; y < h; y += 0.5) wallQuad(b, f, 'front', W, D, u - w / 2, u + w / 2, y, y + 0.07, 0.07, PAL.metalDark)
}

/** Automotive garage: two roll-up bays, an office door, red fascia and rooftop vents. */
export const garageModel: BuildingModel = (b, f, def) => {
  const W = def.width
  const D = def.depth
  const H = def.height
  const wall = pick(PAL.garageWall, def.variant)
  shell(b, f, W, D, H, wall, PAL.plinth, 0.6)
  for (const u of [-W * 0.27, W * 0.05]) rollUp(b, f, W, D, u, 5.2, 4.4, PAL.frameWhite)
  door(b, f, W, D, W * 0.36, 1.1, 2.2, PAL.door, PAL.frameWhite)
  windowGrid(b, f, 'front', W, D, { a0: W * 0.4 - 1.5, a1: W * 0.4 + 1.5, yBase: 0, floorH: H, floors: 1, cols: 1, winW: 2.2, winH: 1.3, sill: 1.1, glass: PAL.glass, frame: PAL.frameDark })
  for (const side of ['left', 'right'] as const) {
    windowGrid(b, f, side, W, D, { a0: -D / 2 + 3, a1: D / 2 - 3, yBase: 0, floorH: H, floors: 1, cols: 2, winW: 2.2, winH: 1.2, sill: 3.4, glass: PAL.glass, frame: PAL.frameDark })
  }
  // Hazard stripe along the base, red fascia, canopy over the bays.
  for (let u = -W / 2 + 0.5; u < W / 2 - 1; u += 2) wallQuad(b, f, 'front', W, D, u, u + 1, 0.6, 0.95, 0.03, PAL.hazard)
  awning(b, f, -W * 0.27 - 3.2, W * 0.05 + 3.2, 5.4, D / 2, 1.4, 0.3, '#c9372c')
  flatRoof(b, f, W, D, H, 0.5, PAL.roofDark, '#c9372c')
  rooftopUnit(b, f, -W / 4, 0, 2.6, 2.6, H + 0.1, 1.5, PAL.metal)
  rooftopUnit(b, f, W / 4, -D / 4, 1.4, 1.4, H + 0.1, 2.6, PAL.metalDark)
  return { signs: [{ text: def.name, u: 0, y: 6.45, v: D / 2 + 0.1, width: 10, height: 1.0, board: '#1c2430', ink: '#ff5a43' }] }
}

/** Warehouse: striped metal cladding, shallow gable roof, big roll-up doors, a side loading dock with bumpers. */
export const warehouseModel: BuildingModel = (b, f, def) => {
  const W = def.width
  const D = def.depth
  const H = def.height
  const wall = pick(PAL.warehouseWall, def.variant)
  const stripe = pick(PAL.warehouseStripe, def.variant)
  shell(b, f, W, D, H, wall, PAL.concreteDark, 1.2)
  // Corrugated look: alternate vertical bands on the long walls.
  for (const side of ['front', 'back'] as const) {
    for (let u = -W / 2 + 1; u < W / 2 - 1; u += 2) wallQuad(b, f, side, W, D, u, u + 0.9, 1.2, H - 0.2, 0.025, stripe)
  }
  for (const side of ['left', 'right'] as const) {
    for (let v = -D / 2 + 1; v < D / 2 - 1; v += 2) wallQuad(b, f, side, W, D, v, v + 0.9, 1.2, H - 0.2, 0.025, stripe)
  }
  // Doors on the front and a clerestory window band.
  rollUp(b, f, W, D, 0, 6.5, 5.6, '#3b6ea5')
  for (const u of [-W * 0.3, W * 0.3]) rollUp(b, f, W, D, u, 4.2, 4.0, PAL.frameWhite)
  door(b, f, W, D, W * 0.43, 1.2, 2.3, PAL.door, PAL.frameWhite)
  windowGrid(b, f, 'front', W, D, { a0: -W / 2 + 2, a1: W / 2 - 2, yBase: H - 2.6, floorH: 2, floors: 1, cols: 10, winW: 2.2, winH: 1.1, sill: 0.4, glass: PAL.glass, frame: PAL.frameDark })
  windowGrid(b, f, 'back', W, D, { a0: -W / 2 + 2, a1: W / 2 - 2, yBase: H - 2.6, floorH: 2, floors: 1, cols: 10, winW: 2.2, winH: 1.1, sill: 0.4, glass: PAL.glass, frame: PAL.frameDark })
  gableRoof(b, f, { u0: -W / 2, u1: W / 2, v0: -D / 2, v1: D / 2, yEave: H, rise: 2.2, overhang: 0.5, ridge: 'u', roof: PAL.roofGrey, gable: wall })
  lbox(b, f, -W / 4, W / 4, H + 2.2, H + 2.7, -0.6, 0.6, PAL.metalDark)
  // Loading dock on the right wall: platform, dock doors, bumpers, canopy.
  const dockLen = D - 8
  lbox(b, f, W / 2, W / 2 + 3, 0, 1.2, -dockLen / 2, dockLen / 2, PAL.concrete)
  const solids: LocalSolid[] = [{ u0: W / 2, u1: W / 2 + 3, v0: -dockLen / 2, v1: dockLen / 2, y1: 1.2 }]
  for (let i = 0; i < 4; i++) {
    const v = -dockLen / 2 + 2.2 + (i * (dockLen - 4.4)) / 3
    wallQuad(b, f, 'right', W, D, v - 1.3, v + 1.3, 1.2, 4.6, 0.04, PAL.metal)
    wallQuad(b, f, 'right', W, D, v - 1.1, v + 1.1, 1.2, 4.4, 0.06, PAL.frameWhite)
    lbox(b, f, W / 2, W / 2 + 0.3, 0.9, 1.5, v - 0.7, v - 0.4, '#1b1b1f')
    lbox(b, f, W / 2, W / 2 + 0.3, 0.9, 1.5, v + 0.4, v + 0.7, '#1b1b1f')
  }
  lbox(b, f, W / 2, W / 2 + 3.4, 5.3, 5.5, -dockLen / 2, dockLen / 2, PAL.metalDark)
  return { signs: [{ text: def.name, u: 0, y: H - 1.6, v: D / 2 + 0.1, width: 12, height: 1.5, board: '#22344f', ink: '#f2f4f7' }], solids }
}

/** Small industrial workshop: steel-clad shed with a mono-pitch roof, roll-up door, exhaust stack. */
export const workshopModel: BuildingModel = (b, f, def) => {
  const W = def.width
  const D = def.depth
  const H = def.height
  const wall = pick(['#a9b5c2', '#b8b4a6', '#9fb0a6'], def.variant)
  shell(b, f, W, D, H, wall, PAL.concreteDark, 0.8)
  for (let u = -W / 2 + 1; u < W / 2 - 1; u += 1.6) wallQuad(b, f, 'front', W, D, u, u + 0.7, 0.8, H - 0.2, 0.025, PAL.metalDark)
  rollUp(b, f, W, D, -W * 0.18, 4.4, 4.0, '#d9a441')
  door(b, f, W, D, W * 0.3, 1.1, 2.2, PAL.door, PAL.frameWhite)
  windowGrid(b, f, 'front', W, D, { a0: W * 0.05, a1: W * 0.45, yBase: 0, floorH: H, floors: 1, cols: 1, winW: 2.4, winH: 1.2, sill: 1.4, glass: PAL.glass, frame: PAL.frameDark, skip: () => false })
  for (const side of ['left', 'right'] as const) {
    windowGrid(b, f, side, W, D, { a0: -D / 2 + 2, a1: D / 2 - 2, yBase: 0, floorH: H, floors: 1, cols: 3, winW: 1.6, winH: 1.0, sill: 3.0, glass: PAL.glass, frame: PAL.frameDark })
  }
  // Mono-pitch roof: low at the front, high at the back, with closed ends.
  const rise = 1.6
  const o = 0.4
  const n = Math.hypot(D, rise)
  b.quad(f.pt(-W / 2 - o, H, D / 2 + o), f.pt(W / 2 + o, H, D / 2 + o), f.pt(W / 2 + o, H + rise, -D / 2 - o), f.pt(-W / 2 - o, H + rise, -D / 2 - o), f.normal(0, D / n, rise / n), PAL.roofRed)
  for (const [u, s] of [[-W / 2, -1], [W / 2, 1]] as const) b.tri(f.pt(u, H, D / 2), f.pt(u, H, -D / 2), f.pt(u, H + rise, -D / 2), wall, f.normal(s, 0, 0))
  lbox(b, f, -W / 2, W / 2, H, H + rise, -D / 2 - 0.02, -D / 2, wall)
  lbox(b, f, W / 4 - 0.35, W / 4 + 0.35, H, H + 5, -D / 2 + 1, -D / 2 + 1.7, PAL.metalDark)
  awning(b, f, W * 0.3 - 1.2, W * 0.3 + 1.2, 2.9, D / 2, 1.0, 0.2, PAL.metalDark)
  return { signs: [{ text: def.name, u: 0, y: H - 0.1, v: D / 2 + 0.1, width: 7, height: 0.8, board: '#2d2f36', ink: '#ffb347' }] }
}
