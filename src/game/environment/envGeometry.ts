import { BufferGeometry, Float32BufferAttribute } from 'three'
import { ROAD_TOP } from '../city/cityConfig'
import type { DistrictId } from '../city/cityTypes'
import { GeometryBuilder } from '../city/geometryBuilder'
import { surfaceHeightAt } from '../city/citySurface'
import { BUILDING_MODELS } from './buildingModels'
import { lbox } from './buildingParts'
import { BUILDING_INFO, ENVIRONMENT } from './envLayout'
import type { EnvironmentLayout } from './envTypes'
import { Frame } from './localFrame'
import { drawProp } from './propModels'
import { addNightEmission } from './environmentLighting'

/**
 * Turns the environment layout into render geometry:
 *  - one merged, vertex-coloured mesh per district (buildings + props),
 *  - two flat paint layers (base paving/lawn, then lines on top),
 *  - one textured sign mesh (every sign shares one canvas atlas),
 *  - tree instance data for instanced rendering.
 * Everything is built once at load; nothing here runs per frame.
 */

/** Atlas cell in pixels; every sign is drawn into a cell of this size. */
export const SIGN_CELL = { w: 1024, h: 128 } as const

export interface SignEntry {
  text: string
  board: string
  ink: string
  /** World width / height of the sign, for drawing text without stretching. */
  aspect: number
}

export interface TreeInstance {
  kind: 'tree-round' | 'tree-conifer'
  x: number
  y: number
  z: number
  scale: number
  rotation: number
  /** Index into the leaf palette. */
  tone: number
}

export interface EnvGeometry {
  chunks: Array<{ district: DistrictId; geometry: BufferGeometry }>
  paintBase: BufferGeometry
  paintLines: BufferGeometry
  signs: { geometry: BufferGeometry; entries: SignEntry[] }
  trees: TreeInstance[]
  stats: { triangles: number; drawCalls: number; signs: number; trees: number }
}

const DISTRICTS: readonly DistrictId[] = ['downtown', 'residential', 'motor-row', 'industrial', 'riverside', 'central-plaza']
/** Paint sits just above the surface it lies on; the lines layer sits above the base layer. */
const PAINT_LIFT = { base: 0.004, lines: 0.009 } as const

const surfaceAt = (x: number, z: number) => surfaceHeightAt(x, z) || ROAD_TOP

function buildSigns(env: EnvironmentLayout): EnvGeometry['signs'] & { backings: Array<(b: Map<DistrictId, GeometryBuilder>) => void> } {
  const entries: SignEntry[] = []
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  const backings: Array<(b: Map<DistrictId, GeometryBuilder>) => void> = []
  const placed = BUILDING_INFO.flatMap((info) => info.signs.map((s) => ({ info, s })))
  const rows = placed.length
  placed.forEach(({ info, s }, i) => {
    const f = new Frame(info.def.x, info.def.z, info.def.facing)
    entries.push({ text: s.text, board: s.board, ink: s.ink, aspect: s.width / s.height })
    // Dark backing box behind the board, drawn into the building's district mesh.
    backings.push((builders) => {
      const b = builders.get(info.def.districtId)
      if (b) lbox(b, f, s.u - s.width / 2 - 0.12, s.u + s.width / 2 + 0.12, s.y - s.height / 2 - 0.1, s.y + s.height / 2 + 0.1, s.v - 0.12, s.v, '#24272e')
    })
    const v = s.v + 0.015
    const corners = [
      f.pt(s.u - s.width / 2, s.y - s.height / 2, v),
      f.pt(s.u + s.width / 2, s.y - s.height / 2, v),
      f.pt(s.u + s.width / 2, s.y + s.height / 2, v),
      f.pt(s.u - s.width / 2, s.y + s.height / 2, v),
    ]
    const n = f.normal(0, 0, 1)
    const v0 = 1 - (i + 1) / rows
    const v1 = 1 - i / rows
    const base = positions.length / 3
    corners.forEach((c, k) => {
      positions.push(...c)
      normals.push(...n)
      uvs.push(k === 0 || k === 3 ? 0 : 1, k < 2 ? v0 : v1)
    })
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
  })
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeBoundingSphere()
  geometry.computeBoundingBox()
  void env
  return { geometry, entries, backings }
}

export function buildEnvironmentGeometry(env: EnvironmentLayout = ENVIRONMENT): EnvGeometry {
  const builders = new Map<DistrictId, GeometryBuilder>(DISTRICTS.map((d) => [d, new GeometryBuilder()]))
  for (const info of BUILDING_INFO) {
    const b = builders.get(info.def.districtId) as GeometryBuilder
    BUILDING_MODELS[info.def.type](b, new Frame(info.def.x, info.def.z, info.def.facing), info.def)
  }
  const trees: TreeInstance[] = []
  for (const p of env.props) {
    const y = surfaceAt(p.x, p.z)
    if (p.kind === 'tree-round' || p.kind === 'tree-conifer') {
      trees.push({ kind: p.kind, x: p.x, y, z: p.z, scale: 0.85 + (p.variant % 5) * 0.1, rotation: (p.variant * 1.7) % (Math.PI * 2), tone: p.variant })
    } else {
      drawProp(builders.get(p.districtId) as GeometryBuilder, p, y)
    }
  }
  const signs = buildSigns(env)
  signs.backings.forEach((draw) => draw(builders))

  const base = new GeometryBuilder()
  const lines = new GeometryBuilder()
  for (const p of env.paint) {
    const y = (p.y ?? ROAD_TOP) + PAINT_LIFT[p.layer]
    ;(p.layer === 'base' ? base : lines).top(p.rect, y, p.color)
  }
  const chunks = DISTRICTS.map((district) => ({ district, geometry: (builders.get(district) as GeometryBuilder).build() }))
  chunks.forEach((chunk) => addNightEmission(chunk.geometry))
  const paintBase = base.build()
  const paintLines = lines.build()
  const triangles = chunks.reduce((n, c) => n + (c.geometry.getIndex()?.count ?? 0) / 3, 0) + (paintBase.getIndex()?.count ?? 0) / 3 + (paintLines.getIndex()?.count ?? 0) / 3
  return {
    chunks,
    paintBase,
    paintLines,
    signs: { geometry: signs.geometry, entries: signs.entries },
    trees,
    stats: { triangles, drawCalls: chunks.length + 3 + 3, signs: signs.entries.length, trees: trees.length },
  }
}
