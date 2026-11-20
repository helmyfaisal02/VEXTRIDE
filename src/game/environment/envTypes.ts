import type { DistrictId, Rect } from '../city/cityTypes'

/** Which street side a building's entrance faces. N is -Z, S is +Z, E is +X, W is -X. */
export type Facing = 'N' | 'E' | 'S' | 'W'

export type BuildingType =
  | 'office'
  | 'brick-commercial'
  | 'apartment'
  | 'house'
  | 'convenience-store'
  | 'garage'
  | 'showroom'
  | 'warehouse'
  | 'workshop'

/** A building placed on a lot. `width` runs along the facade, `depth` front to back. */
export interface BuildingDef {
  id: string
  type: BuildingType
  districtId: DistrictId
  blockId: string
  /** Footprint centre. */
  x: number
  z: number
  width: number
  depth: number
  /** Wall height (m), not counting roof structures. */
  height: number
  facing: Facing
  /** Picks colours and small details deterministically. */
  variant: number
  /** Fictional business or building name shown on its sign. */
  name: string
}

export type PropKind =
  | 'streetlight'
  | 'tree-round'
  | 'tree-conifer'
  | 'bench'
  | 'bin'
  | 'planter'
  | 'stop-sign'
  | 'fence'
  | 'container'
  | 'monument'
  | 'hydrant'
  | 'utility-box'
  | 'shelter'
  | 'bollard'
  | 'tire-stack'

export interface PropDef {
  id: string
  kind: PropKind
  districtId: DistrictId
  x: number
  z: number
  /** Direction the prop faces (benches, signs) or runs (fences: N/S = along Z). */
  facing: Facing
  /** Footprint size on the X and Z axes (already rotated), and height. */
  sx: number
  sz: number
  height: number
  variant: number
  /** True when the prop gets a static collider. */
  collide: boolean
}

export interface SignDef {
  id: string
  text: string
  /** Centre of the sign board. */
  x: number
  y: number
  z: number
  facing: Facing
  width: number
  height: number
  board: string
  ink: string
  buildingId: string
}

/** Flat paint on a lot: `base` layer (lawn, paving, pads) or `lines` on top of it. */
export interface PaintRect {
  rect: Rect
  color: string
  layer: 'base' | 'lines'
  /** Surface height the paint lies on (lot level by default; the plaza is raised). */
  y?: number
}

export interface ColliderBox {
  id: string
  rect: Rect
  y0: number
  y1: number
}

export interface EnvironmentLayout {
  buildings: BuildingDef[]
  props: PropDef[]
  signs: SignDef[]
  paint: PaintRect[]
  colliders: ColliderBox[]
  /** Space kept free for a future river (no buildings or props). */
  riverReserve: Rect
  /** Areas that must stay free of solid objects: the spawn and the building doorsteps. */
  keepClear: Array<{ id: string; rect: Rect }>
}
