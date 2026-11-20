import type { GeometryBuilder } from '../city/geometryBuilder'
import type { BuildingDef } from './envTypes'
import type { Frame } from './localFrame'

/** A sign board in a building's local frame, facing out of the front wall. */
export interface LocalSign {
  text: string
  u: number
  y: number
  /** Position of the board's front face along v. */
  v: number
  width: number
  height: number
  board: string
  ink: string
}

/** An extra solid part of a building (loading dock, column) in the local frame, from the ground to `y1`. */
export interface LocalSolid {
  u0: number
  u1: number
  v0: number
  v1: number
  y1: number
}

export interface ModelResult {
  signs: LocalSign[]
  /** Solids beyond the main footprint that need their own collider. */
  solids?: LocalSolid[]
}

export type BuildingModel = (b: GeometryBuilder, f: Frame, def: BuildingDef) => ModelResult
