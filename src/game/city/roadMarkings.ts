import { LINE_CLASS, MARKING, ROAD_TOP, SURFACE_COLORS } from './cityConfig'
import type { CityLayout, Junction, Rect, RoadSegment } from './cityTypes'
import type { GeometryBuilder } from './geometryBuilder'

/**
 * Lane lines, crosswalks and stop lines, written as flat quads a few
 * millimetres above the asphalt. Everything is positioned from the road and
 * junction rectangles, so markings always line up with the road they sit on.
 *
 * Along a road the layout is, from each junction edge outward: crosswalk,
 * stop line (approaching lane only), then the lane lines begin.
 */

const Y = ROAD_TOP + MARKING.lift

/** A junction is "major" when a main road passes through it; those get crosswalks. */
export function isMajorJunction(j: Junction): boolean {
  return LINE_CLASS[j.col] === 'main' || LINE_CLASS[j.row] === 'main'
}

/** Distances (from the junction edge) where each marking element starts and ends. */
export function approachLayout(major: boolean) {
  if (major) {
    const crosswalkStart = MARKING.junctionClearance
    const crosswalkEnd = crosswalkStart + MARKING.crosswalkDepth
    const stopStart = crosswalkEnd + 1
    return { crosswalk: [crosswalkStart, crosswalkEnd] as const, stop: [stopStart, stopStart + MARKING.stopLineDepth] as const, linesStart: stopStart + MARKING.stopLineDepth + 0.6 }
  }
  const stopStart = 1
  return { crosswalk: null, stop: [stopStart, stopStart + MARKING.stopLineDepth] as const, linesStart: stopStart + MARKING.stopLineDepth + 0.6 }
}

/** Maps (along, across) road coordinates to a world rectangle. */
function toRect(road: RoadSegment, a0: number, a1: number, c0: number, c1: number): Rect {
  return road.axis === 'x'
    ? { minX: a0, maxX: a1, minZ: c0, maxZ: c1 }
    : { minX: c0, maxX: c1, minZ: a0, maxZ: a1 }
}

function dashes(from: number, to: number): Array<[number, number]> {
  const len = to - from
  const pitch = MARKING.dashLength + MARKING.dashGap
  const n = Math.floor((len + MARKING.dashGap) / pitch)
  if (n < 1) return []
  const total = n * MARKING.dashLength + (n - 1) * MARKING.dashGap
  const start = from + (len - total) / 2
  return Array.from({ length: n }, (_, i) => {
    const a = start + i * pitch
    return [a, a + MARKING.dashLength]
  })
}

function drawRoad(
  road: RoadSegment,
  layout: CityLayout,
  out: GeometryBuilder,
): void {
  const centre = road.axis === 'x' ? road.start.z : road.start.x
  const lo = road.axis === 'x' ? road.rect.minX : road.rect.minZ
  const hi = road.axis === 'x' ? road.rect.maxX : road.rect.maxZ
  const jFrom = layout.junctions.find((j) => j.id === road.from) as Junction
  const jTo = layout.junctions.find((j) => j.id === road.to) as Junction
  const near = approachLayout(isMajorJunction(jFrom))
  const far = approachLayout(isMajorJunction(jTo))
  const a = lo + near.linesStart
  const b = hi - far.linesStart
  const half = road.width / 2
  const line = MARKING.line
  const WHITE = SURFACE_COLORS.markingWhite
  const YELLOW = SURFACE_COLORS.markingYellow
  const put = (color: string, a0: number, a1: number, c0: number, c1: number) =>
    out.top(toRect(road, a0, a1, c0, c1), Y, color)

  if (b > a) {
    if (road.class === 'main') {
      // Double solid yellow centre, dashed white lane lines, solid white edge lines.
      const off = MARKING.doubleGap / 2
      put(YELLOW, a, b, centre - off - line, centre - off)
      put(YELLOW, a, b, centre + off, centre + off + line)
      for (const side of [-1, 1]) {
        const c = centre + side * (road.width / 4)
        for (const [d0, d1] of dashes(a, b)) put(WHITE, d0, d1, c - line / 2, c + line / 2)
        const edge = centre + side * (half - 0.4)
        put(WHITE, a, b, edge - line / 2, edge + line / 2)
      }
    } else {
      for (const [d0, d1] of dashes(a, b)) put(YELLOW, d0, d1, centre - line / 2, centre + line / 2)
    }
  }

  // Crosswalks and stop lines at both ends.
  const ends: Array<{ side: 'from' | 'to'; plan: ReturnType<typeof approachLayout>; edge: number; sign: 1 | -1; junction: Junction }> = [
    { side: 'from', plan: near, edge: lo, sign: 1, junction: jFrom },
    { side: 'to', plan: far, edge: hi, sign: -1, junction: jTo },
  ]
  for (const { plan, edge, sign, junction } of ends) {
    const span = (d0: number, d1: number): [number, number] => {
      const p = edge + sign * d0
      const q = edge + sign * d1
      return p < q ? [p, q] : [q, p]
    }
    if (plan.crosswalk) {
      const [c0, c1] = span(plan.crosswalk[0], plan.crosswalk[1])
      const pitch = MARKING.crosswalkStripe + MARKING.crosswalkGap
      for (let c = centre - half + 0.75; c + MARKING.crosswalkStripe <= centre + half - 0.5; c += pitch) {
        put(WHITE, c0, c1, c, c + MARKING.crosswalkStripe)
      }
    }
    // The stop line covers only the lane that arrives at this junction.
    const arriving = layout.laneEdges.find((l) => l.roadId === road.id && l.to === junction.id)
    if (arriving) {
      const laneCentre = road.axis === 'x' ? arriving.start.z : arriving.start.x
      const [s0, s1] = span(plan.stop[0], plan.stop[1])
      const across: [number, number] = laneCentre > centre ? [centre + 0.15, centre + half - 0.1] : [centre - half + 0.1, centre - 0.15]
      put(WHITE, s0, s1, across[0], across[1])
    }
  }
}

export function buildMarkings(layout: CityLayout, out: GeometryBuilder): void {
  for (const road of layout.roads) drawRoad(road, layout, out)
}
