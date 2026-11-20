import type { BufferGeometry } from 'three'
import {
  CURB_BAND,
  DISTRICT_COLORS,
  ROAD_TOP,
  SIDEWALK_TOP,
  SIDEWALK_WIDTH,
  SURFACE_COLORS,
} from './cityConfig'
import { CITY } from './cityLayout'
import type { Block, CityLayout, Rect, SidewalkSegment } from './cityTypes'
import { GeometryBuilder } from './geometryBuilder'
import { buildMarkings } from './roadMarkings'
import { DRIVEWAYS } from './driveways'
import { drawSidewalk } from './sidewalkGeometry'

/**
 * Turns the city layout into two merged, vertex-coloured geometries:
 *  - `surface`: asphalt, lots, sidewalks, curbs and the plaza (one draw call)
 *  - `markings`: every painted line and crosswalk (one draw call)
 * Built once at startup; nothing is regenerated per frame.
 */

export interface CityGeometries {
  surface: BufferGeometry
  markings: BufferGeometry
  stats: { surfaceTriangles: number; markingTriangles: number }
}

const inset = (r: Rect, d: number): Rect => ({ minX: r.minX + d, maxX: r.maxX - d, minZ: r.minZ + d, maxZ: r.maxZ - d })

/** A frame (ring) of top quads between an outer rect and the same rect inset by `width`. */
function frameTop(b: GeometryBuilder, outer: Rect, width: number, y: number, color: string): void {
  const i = inset(outer, width)
  b.top({ minX: outer.minX, maxX: outer.maxX, minZ: outer.minZ, maxZ: i.minZ }, y, color)
  b.top({ minX: outer.minX, maxX: outer.maxX, minZ: i.maxZ, maxZ: outer.maxZ }, y, color)
  b.top({ minX: outer.minX, maxX: i.minX, minZ: i.minZ, maxZ: i.maxZ }, y, color)
  b.top({ minX: i.maxX, maxX: outer.maxX, minZ: i.minZ, maxZ: i.maxZ }, y, color)
}

/** A solid paved block (the plaza): curb band around the edge, paving inside. */
function addPavedBlock(b: GeometryBuilder, block: Block): void {
  frameTop(b, block.rect, CURB_BAND, SIDEWALK_TOP, SURFACE_COLORS.curb)
  b.top(inset(block.rect, CURB_BAND), SIDEWALK_TOP, SURFACE_COLORS.plaza)
  b.sides(block.rect, 0, SIDEWALK_TOP, SURFACE_COLORS.curb)
}

/** A sidewalk ring around a lot, with the lot (future buildings) tinted by district. */
function addRingBlock(b: GeometryBuilder, block: Block): void {
  const lot = block.lot as Rect
  frameTop(b, block.rect, CURB_BAND, SIDEWALK_TOP, SURFACE_COLORS.curb)
  frameTop(b, inset(block.rect, CURB_BAND), SIDEWALK_WIDTH - CURB_BAND, SIDEWALK_TOP, SURFACE_COLORS.sidewalk)
  b.sides(block.rect, 0, SIDEWALK_TOP, SURFACE_COLORS.curb)
  // The ring's inner face drops from the sidewalk to the lot.
  b.sides(lot, ROAD_TOP, SIDEWALK_TOP, SURFACE_COLORS.curb, true)
  b.top(lot, ROAD_TOP, DISTRICT_COLORS[block.districtId])
}

/** City-edge sidewalk: paving with a curb band along the road-facing edge. */
function addPerimeter(b: GeometryBuilder, s: SidewalkSegment): void {
  const r = s.rect
  const c = CURB_BAND
  // Perimeter strips face inward, toward the ring road.
  const bands: Record<string, [Rect, Rect]> = {
    N: [{ ...r, minZ: r.maxZ - c }, { ...r, maxZ: r.maxZ - c }],
    S: [{ ...r, maxZ: r.minZ + c }, { ...r, minZ: r.minZ + c }],
    W: [{ ...r, minX: r.maxX - c }, { ...r, maxX: r.maxX - c }],
    E: [{ ...r, maxX: r.minX + c }, { ...r, minX: r.minX + c }],
  }
  const [band, paving] = bands[s.id.slice(-1)]
  b.top(band, s.top, SURFACE_COLORS.curb)
  b.top(paving, s.top, SURFACE_COLORS.sidewalk)
  b.sides(r, 0, s.top, SURFACE_COLORS.curb)
}

export function buildCityGeometries(layout: CityLayout = CITY): CityGeometries {
  const surface = new GeometryBuilder()
  for (const j of layout.junctions) surface.top(j.rect, ROAD_TOP, SURFACE_COLORS.asphalt)
  for (const r of layout.roads) surface.top(r.rect, ROAD_TOP, SURFACE_COLORS.asphalt)
  for (const block of layout.blocks) {
    if (!block.paved && DRIVEWAYS.some((d) => d.blockId === block.id)) {
      for (const s of layout.sidewalks.filter((s) => s.blockId === block.id)) drawSidewalk(surface, s, block.rect)
      surface.top(block.lot as Rect, ROAD_TOP, DISTRICT_COLORS[block.districtId])
    } else (block.paved ? addPavedBlock : addRingBlock)(surface, block)
  }
  for (const s of layout.sidewalks) if (s.side === 'perimeter') addPerimeter(surface, s)

  const markings = new GeometryBuilder()
  buildMarkings(layout, markings)

  return {
    surface: surface.build(),
    markings: markings.build(),
    stats: { surfaceTriangles: surface.triangleCount, markingTriangles: markings.triangleCount },
  }
}
