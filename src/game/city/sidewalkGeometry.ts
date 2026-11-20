import { CURB_BAND, ROAD_TOP, SURFACE_COLORS } from './cityConfig'
import type { Rect, SidewalkSegment } from './cityTypes'
import { DRIVEWAYS, sidewalkHeight, type Driveway } from './driveways'
import { GeometryBuilder } from './geometryBuilder'

/** Shared render/collision solid for a strip with lowered crossings and planar shoulders.
 * Only the affected Motor Row blocks use this path. No overlapping full-height slab remains.
 */
export function drawSidewalk(b: GeometryBuilder, s: SidewalkSegment, block: Rect, cuts: readonly Driveway[] = DRIVEWAYS): void {
  const r = s.rect
  const xs = new Set([r.minX, r.maxX])
  for (const cut of cuts.filter((d) => d.sidewalkId === s.id)) {
    for (const x of [cut.center - cut.width / 2 - cut.flare, cut.center - cut.width / 2, cut.center + cut.width / 2, cut.center + cut.width / 2 + cut.flare]) xs.add(x)
  }
  for (const x of [block.minX + CURB_BAND, block.maxX - CURB_BAND]) if (x > r.minX && x < r.maxX) xs.add(x)
  const xList = [...xs].sort((a, c) => a - c)
  const zs = [r.minZ, r.maxZ, block.minZ + CURB_BAND, block.maxZ - CURB_BAND].filter((z, i, a) => z >= r.minZ && z <= r.maxZ && a.indexOf(z) === i).sort((a, c) => a - c)
  const at = (x: number, z: number): [number, number, number] => [x, sidewalkHeight(x, s, cuts), z]
  for (let i = 0; i < xList.length - 1; i++) {
    const x0 = xList[i], x1 = xList[i + 1]
    const h0 = sidewalkHeight(x0, s, cuts), h1 = sidewalkHeight(x1, s, cuts)
    for (let j = 0; j < zs.length - 1; j++) {
      const z0 = zs[j], z1 = zs[j + 1], x = (x0 + x1) / 2, z = (z0 + z1) / 2
      const band = Math.min(x - block.minX, block.maxX - x, z - block.minZ, block.maxZ - z) < CURB_BAND + 1e-8
      const color = h0 === ROAD_TOP && h1 === ROAD_TOP ? SURFACE_COLORS.driveway : band ? SURFACE_COLORS.curb : SURFACE_COLORS.sidewalk
      b.quad(at(x0, z0), at(x0, z1), at(x1, z1), at(x1, z0), [-(h1 - h0) / (x1 - x0), 1, 0], color)
    }
    // Only outside faces; no hidden internal walls between shoulder sections.
    b.quad([x0, 0, r.minZ], [x1, 0, r.minZ], at(x1, r.minZ), at(x0, r.minZ), [0, 0, -1], SURFACE_COLORS.curb)
    b.quad([x1, 0, r.maxZ], [x0, 0, r.maxZ], at(x0, r.maxZ), at(x1, r.maxZ), [0, 0, 1], SURFACE_COLORS.curb)
  }
  for (const [x, sign] of [[r.minX, -1], [r.maxX, 1]] as const) {
    b.quad([x, 0, r.minZ], [x, 0, r.maxZ], at(x, r.maxZ), at(x, r.minZ), [sign, 0, 0], SURFACE_COLORS.curb)
  }
}

export function buildSidewalkGeometry(s: SidewalkSegment, block: Rect) {
  const builder = new GeometryBuilder()
  drawSidewalk(builder, s, block)
  return builder.build()
}
