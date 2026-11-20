import { BUILDINGS } from '../environment/buildingPlacements'
import type { BuildingDef } from '../environment/envTypes'
import { CITY } from './cityLayout'
import { ROAD_TOP, SIDEWALK_TOP } from './cityConfig'
import type { CityLayout, Rect, SidewalkSegment } from './cityTypes'

export interface Driveway {
  id: string
  blockId: string
  sidewalkId: string
  roadId: string
  side: 'N' | 'S'
  center: number
  /** Clear, flat opening; pedestrian shoulders are outside this width. */
  width: number
  flare: number
  crossing: Rect
  approach: Rect
  buildingId?: string
  parkingId?: string
}

/** Existing parking pads, shared with their paint generator. */
export function motorParking(layout: CityLayout = CITY) {
  const north = layout.blocks.find((b) => b.id === 'B30')!.lot!
  const south = layout.blocks.find((b) => b.id === 'B31')!.lot!
  return {
    north: { minX: north.minX + 3, maxX: north.maxX - 2, minZ: north.minZ + 3, maxZ: north.minZ + 31 },
    south: { minX: south.minX + 31, maxX: south.maxX - 3, minZ: south.maxZ - 24, maxZ: south.maxZ - 2 },
  }
}

/** Explicit entrances tied to existing bays/pads; the road graph is never changed. */
export function buildDriveways(layout: CityLayout = CITY, buildings: readonly BuildingDef[] = BUILDINGS): Driveway[] {
  const garage = buildings.find((b) => b.id === 'building-12')!
  const showroom = buildings.find((b) => b.id === 'building-13')!
  const pads = motorParking(layout)
  const specs = [
    { id: 'garage-bay', blockId: garage.blockId, side: 'S' as const, center: garage.x + garage.width * 0.05, width: 6, buildingId: garage.id, end: garage.z + garage.depth / 2 },
    { id: 'showroom', blockId: showroom.blockId, side: 'S' as const, center: showroom.x, width: 8, buildingId: showroom.id, end: showroom.z + showroom.depth / 2 },
    { id: 'north-parking', blockId: 'B30', side: 'N' as const, center: pads.north.minX + 24, width: 6, parkingId: 'north', end: (pads.north.minZ + pads.north.maxZ) / 2 },
    { id: 'south-parking', blockId: 'B31', side: 'S' as const, center: pads.south.minX + 6, width: 6, parkingId: 'south', end: (pads.south.minZ + pads.south.maxZ) / 2 },
  ]
  return specs.map(({ end, ...spec }) => {
    const sidewalkId = `${spec.blockId}-${spec.side}`
    const sidewalk = layout.sidewalks.find((s) => s.id === sidewalkId)!
    const edge = spec.side === 'N' ? sidewalk.rect.minZ : sidewalk.rect.maxZ
    const road = layout.roads.find((r) => r.axis === 'x' && spec.center > r.rect.minX && spec.center < r.rect.maxX && (spec.side === 'N' ? r.rect.maxZ === edge : r.rect.minZ === edge))!
    const minX = spec.center - spec.width / 2, maxX = spec.center + spec.width / 2
    return {
      ...spec, sidewalkId, roadId: road.id, flare: 1.5,
      crossing: { minX, maxX, minZ: sidewalk.rect.minZ, maxZ: sidewalk.rect.maxZ },
      approach: { minX, maxX, minZ: Math.min(edge, end), maxZ: Math.max(edge, end) },
    }
  })
}

export const DRIVEWAYS = buildDriveways()

export function sidewalkHeight(x: number, sidewalk: SidewalkSegment, driveways: readonly Driveway[] = DRIVEWAYS): number {
  let height = sidewalk.top
  for (const cut of driveways) {
    if (cut.sidewalkId !== sidewalk.id) continue
    const shoulder = Math.max(0, Math.min(1, (Math.abs(x - cut.center) - cut.width / 2) / cut.flare))
    height = Math.min(height, ROAD_TOP + (SIDEWALK_TOP - ROAD_TOP) * shoulder)
  }
  return height
}
