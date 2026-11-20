import { CITY_SPAWN, SIDEWALK_TOP } from '../city/cityConfig'
import { CITY } from '../city/cityLayout'
import type { CityLayout, Rect } from '../city/cityTypes'
import { GeometryBuilder } from '../city/geometryBuilder'
import { BUILDING_MODELS } from './buildingModels'
import { BUILDINGS } from './buildingPlacements'
import { placeDowntown, placeMotorRow, placeResidential, type DistrictContext } from './districtsA'
import { placeIndustrial, placePlaza, placeRiverside } from './districtsB'
import type { BuildingDef, ColliderBox, EnvironmentLayout, PropDef } from './envTypes'
import { Frame, footprint } from './localFrame'
import { KIND_SPECS, Placer, propRect } from './propLayout'
import { entranceCorridor, cornerZones } from './streetProps'
import type { LocalSign, LocalSolid } from './modelTypes'

/** Space reserved for the future river: the southern strip of the two riverside park lots. */
export const RIVER_RESERVE: Rect = { minX: -150.5, maxX: -9.5, minZ: 134, maxZ: 150.5 }

/** Height of each building's collider above its walls (roof structures). */
const ROOF_EXTRA: Record<BuildingDef['type'], number> = {
  office: 4,
  'brick-commercial': 0.9,
  apartment: 3,
  house: 2.8,
  'convenience-store': 1.1,
  garage: 1,
  showroom: 1,
  warehouse: 2.2,
  workshop: 1.6,
}

export interface BuildingInfo {
  def: BuildingDef
  rect: Rect
  signs: LocalSign[]
  solids: LocalSolid[]
}

/** Runs each model once to learn its signs and extra solids (the geometry itself is built later, per chunk). */
export function inspectBuildings(buildings: readonly BuildingDef[] = BUILDINGS): BuildingInfo[] {
  return buildings.map((def) => {
    const scratch = new GeometryBuilder()
    const result = BUILDING_MODELS[def.type](scratch, new Frame(def.x, def.z, def.facing), def)
    return { def, rect: footprint(def.x, def.z, def.width, def.depth, def.facing), signs: result.signs, solids: result.solids ?? [] }
  })
}

function propColliders(p: PropDef, baseY: number): ColliderBox[] {
  const r = propRect(p.x, p.z, p.kind, p.facing, p.kind === 'fence' ? (p.facing === 'N' || p.facing === 'S' ? p.sz : p.sx) : undefined)
  const box = (id: string, rect: Rect, y1: number, y0 = baseY): ColliderBox => ({ id: `${p.id}:${id}`, rect, y0, y1 })
  const cx = p.x
  const cz = p.z
  switch (p.kind) {
    case 'tree-round':
    case 'tree-conifer':
      return [box('trunk', r, baseY + 3)]
    case 'monument':
      return [
        box('base', { minX: cx - 4.5, maxX: cx + 4.5, minZ: cz - 4.5, maxZ: cz + 4.5 }, baseY + 0.9),
        box('obelisk', { minX: cx - 1.1, maxX: cx + 1.1, minZ: cz - 1.1, maxZ: cz + 1.1 }, baseY + p.height),
      ]
    case 'shelter':
      return [[-3, -1.8], [3, -1.8], [-3, 1.8], [3, 1.8]].map(([dx, dz], i) => box(`post${i}`, { minX: cx + dx - 0.2, maxX: cx + dx + 0.2, minZ: cz + dz - 0.2, maxZ: cz + dz + 0.2 }, baseY + p.height))
    case 'streetlight':
      return [box('pole', r, baseY + 4)]
    default:
      return [box('body', r, baseY + p.height)]
  }
}

/** Builds the whole environment: building list, props, paint, signs and colliders. Deterministic and pure. */
export function buildEnvironment(layout: CityLayout = CITY): EnvironmentLayout {
  const blocks = new Map(layout.blocks.map((b) => [b.id, b]))
  const block = (id: string) => {
    const b = blocks.get(id)
    if (!b) throw new Error(`Unknown block ${id}`)
    return b
  }
  const infos = inspectBuildings()
  const keepClear: EnvironmentLayout['keepClear'] = [
    { id: 'spawn', rect: { minX: CITY_SPAWN.x - 12, maxX: CITY_SPAWN.x + 12, minZ: CITY_SPAWN.z - 12, maxZ: CITY_SPAWN.z + 12 } },
    { id: 'river-reserve', rect: RIVER_RESERVE },
  ]
  for (const info of infos) keepClear.push({ id: `entrance:${info.def.id}`, rect: entranceCorridor(info.def, block(info.def.blockId)) })
  for (const b of layout.blocks) cornerZones(b.rect).forEach((rect, i) => keepClear.push({ id: `corner:${b.id}:${i}`, rect }))

  const solids: Rect[] = []
  const colliders: ColliderBox[] = []
  for (const info of infos) {
    solids.push(info.rect)
    colliders.push({ id: info.def.id, rect: info.rect, y0: 0, y1: info.def.height + ROOF_EXTRA[info.def.type] })
    const f = new Frame(info.def.x, info.def.z, info.def.facing)
    info.solids.forEach((s, i) => {
      const rect = f.rect(s.u0, s.u1, s.v0, s.v1)
      solids.push(rect)
      colliders.push({ id: `${info.def.id}:solid${i}`, rect, y0: 0, y1: s.y1 })
    })
  }

  const placer = new Placer(solids, keepClear.map((k) => k.rect))
  const ctx: DistrictContext = { placer, block, buildings: BUILDINGS, riverReserve: RIVER_RESERVE }
  placePlaza(ctx)
  placeDowntown(ctx)
  placeResidential(ctx)
  placeMotorRow(ctx)
  placeIndustrial(ctx)
  placeRiverside(ctx)

  for (const p of placer.props) {
    if (!p.collide || !KIND_SPECS[p.kind].collide) continue
    const baseY = layoutSurface(layout, p.x, p.z)
    colliders.push(...propColliders(p, baseY))
  }
  return {
    buildings: [...BUILDINGS],
    props: placer.props,
    signs: [],
    paint: placer.paint,
    colliders,
    riverReserve: RIVER_RESERVE,
    keepClear,
  }
}

function layoutSurface(layout: CityLayout, x: number, z: number): number {
  for (const s of layout.sidewalks) if (x >= s.rect.minX && x <= s.rect.maxX && z >= s.rect.minZ && z <= s.rect.maxZ) return s.top
  return layout.floor.minX <= x && x <= layout.floor.maxX ? 0.03 : 0
}

export { SIDEWALK_TOP }
export const ENVIRONMENT: EnvironmentLayout = buildEnvironment()
export const BUILDING_INFO: BuildingInfo[] = inspectBuildings()
