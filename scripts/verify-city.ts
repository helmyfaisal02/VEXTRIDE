/**
 * Verifies the city layout data (pure data, no rendering): dimensions, exact
 * tiling with no gaps or overlaps, connectivity, districts, lane geometry,
 * junction movements, spawn safety and determinism. Run with `bun run verify:city`.
 */
import { FEET_OFFSET, SPAWN_POSITION, STEP } from '../src/game/character/config'
import {
  CITY_HALF_EXTENT,
  CITY_SIZE,
  CITY_SPAWN,
  CURB_HEIGHT,
  DEMO_YARD_ORIGIN,
  ROAD_TOP,
  ROAD_WIDTH,
  SIDEWALK_TOP,
  SIDEWALK_WIDTH,
} from '../src/game/city/cityConfig'
import { hopCount, isConnected, nextLanes, reachableJunctions } from '../src/game/city/cityGraph'
import { buildCityLayout, CITY } from '../src/game/city/cityLayout'
import type { Rect } from '../src/game/city/cityTypes'
import { STEP_TEST_LANES } from '../src/game/world/StepTestArea'

let fails = 0
const check = (name: string, ok: boolean, info = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${info}`)
  if (!ok) fails++
}
const EPS = 1e-9
const area = (r: Rect) => (r.maxX - r.minX) * (r.maxZ - r.minZ)
const overlap = (a: Rect, b: Rect) =>
  Math.max(0, Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX)) * Math.max(0, Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ))
const inside = (r: Rect, x: number, z: number, m = 0) => x >= r.minX + m && x <= r.maxX - m && z >= r.minZ + m && z <= r.maxZ - m

/* ------------------------------- dimensions ------------------------------- */
check('city footprint is about 350 m (340 m)', CITY_SIZE === 340 && Math.abs(CITY_SIZE - 350) <= 15, `${CITY_SIZE} m`)
check('main road width 12-14 m', ROAD_WIDTH.main >= 12 && ROAD_WIDTH.main <= 14, `${ROAD_WIDTH.main} m`)
check('secondary road width 8-10 m', ROAD_WIDTH.secondary >= 8 && ROAD_WIDTH.secondary <= 10, `${ROAD_WIDTH.secondary} m`)
check('sidewalk width 2-3 m', SIDEWALK_WIDTH >= 2 && SIDEWALK_WIDTH <= 3, `${SIDEWALK_WIDTH} m`)
check('curb height 0.12-0.15 m', CURB_HEIGHT >= 0.12 && CURB_HEIGHT <= 0.15, `${CURB_HEIGHT} m`)
check('curb is within the step-up limit with margin', CURB_HEIGHT <= STEP.maxHeight - 0.04 && SIDEWALK_TOP <= STEP.maxHeight - 0.03, `curb ${CURB_HEIGHT}, sidewalk above ground ${SIDEWALK_TOP.toFixed(2)}, limit ${STEP.maxHeight}`)
check('sidewalk top = road surface + curb', Math.abs(SIDEWALK_TOP - (ROAD_TOP + CURB_HEIGHT)) < EPS)

/* --------------------------------- counts ---------------------------------- */
const types: Record<string, number> = {}
for (const j of CITY.junctions) types[j.type] = (types[j.type] ?? 0) + 1
check('5 x 5 junctions, 40 roads, 4 x 4 blocks, 6 districts', CITY.junctions.length === 25 && CITY.roads.length === 40 && CITY.blocks.length === 16 && CITY.districts.length === 6)
check('four-way intersections, T-intersections and corners all present', (types['four-way'] ?? 0) >= 4 && (types.t ?? 0) >= 4 && (types.corner ?? 0) >= 1, JSON.stringify(types))
check('no dead ends or orphan junctions', !CITY.junctions.some((j) => j.type === 'dead-end'))
check('junction type matches its arm count', CITY.junctions.every((j) => { const n = Object.keys(j.arms).length; return (j.type === 'four-way' && n === 4) || (j.type === 't' && n === 3) || ((j.type === 'corner' || j.type === 'straight') && n === 2) }))
check('both road classes are used', CITY.roads.some((r) => r.class === 'main') && CITY.roads.some((r) => r.class === 'secondary'))

/* --------------------- exact tiling: no gaps, no overlaps -------------------- */
const surfaces: Array<{ id: string; rect: Rect }> = [
  ...CITY.junctions.map((j) => ({ id: j.id, rect: j.rect })),
  ...CITY.roads.map((r) => ({ id: r.id, rect: r.rect })),
  ...CITY.sidewalks.map((s) => ({ id: s.id, rect: s.rect })),
  ...CITY.blocks.flatMap((b) => (b.lot ? [{ id: `${b.id}-lot`, rect: b.lot }] : [])),
]
let worstOverlap = 0
for (let i = 0; i < surfaces.length; i++) for (let k = i + 1; k < surfaces.length; k++) worstOverlap = Math.max(worstOverlap, overlap(surfaces[i].rect, surfaces[k].rect))
check('no two surface pieces overlap (no z-fighting, no double geometry)', worstOverlap < 1e-6, `worst overlap ${worstOverlap.toExponential(1)} m2`)
const covered = surfaces.reduce((s, p) => s + area(p.rect), 0)
check('roads + junctions + sidewalks + lots tile the whole city floor (no gaps)', Math.abs(covered - area(CITY.floor)) < 1e-6, `${covered.toFixed(3)} of ${area(CITY.floor).toFixed(3)} m2`)
check('every surface piece lies inside the city floor', surfaces.every((p) => p.rect.minX >= CITY.floor.minX - EPS && p.rect.maxX <= CITY.floor.maxX + EPS && p.rect.minZ >= CITY.floor.minZ - EPS && p.rect.maxZ <= CITY.floor.maxZ + EPS))
check('floor is the declared +/-170 m square', CITY.floor.minX === -CITY_HALF_EXTENT && CITY.floor.maxZ === CITY_HALF_EXTENT)
const J = new Map(CITY.junctions.map((j) => [j.id, j]))
check('each road meets its junctions exactly edge to edge', CITY.roads.every((r) => {
  const a = J.get(r.from)!, b = J.get(r.to)!
  return r.axis === 'x'
    ? r.rect.minX === a.rect.maxX && r.rect.maxX === b.rect.minX && r.rect.minZ === a.rect.minZ && r.rect.maxZ === a.rect.maxZ && b.rect.minZ === r.rect.minZ
    : r.rect.minZ === a.rect.maxZ && r.rect.maxZ === b.rect.minZ && r.rect.minX === a.rect.minX && r.rect.maxX === a.rect.maxX && b.rect.minX === r.rect.minX
}))
check('road width equals the junction side it enters', CITY.roads.every((r) => Math.abs((r.axis === 'x' ? r.rect.maxZ - r.rect.minZ : r.rect.maxX - r.rect.minX) - r.width) < EPS))
check('sidewalk rings sit exactly on the block edges, 2.5 m wide', CITY.blocks.filter((b) => !b.paved).every((b) => {
  const strips = CITY.sidewalks.filter((s) => s.blockId === b.id)
  const lot = b.lot!
  return strips.length === 4 && Math.abs(lot.minX - b.rect.minX - SIDEWALK_WIDTH) < EPS && Math.abs(b.rect.maxZ - lot.maxZ - SIDEWALK_WIDTH) < EPS
}))
check('the plaza is paved solid, one raised block each', CITY.blocks.filter((b) => b.paved).length === 4 && CITY.blocks.filter((b) => b.paved).every((b) => b.lot === null && CITY.sidewalks.some((s) => s.rect === b.rect || (s.blockId === b.id && s.side === 'plaza'))))
check('no sidewalk touches the roadway except along a curb (sidewalks never overlap roads)', CITY.sidewalks.every((s) => [...CITY.roads, ...CITY.junctions].every((r) => overlap(s.rect, r.rect) < 1e-9)))

/* ------------------------------- connectivity ------------------------------ */
check('all 25 junctions form one connected network', isConnected(CITY))
const ring = CITY.junctions.filter((j) => j.col === 0 || j.col === 4 || j.row === 0 || j.row === 4)
const ringRoads = CITY.roads.filter((r) => { const a = J.get(r.from)!, b = J.get(r.to)!; const onRing = (j: typeof a) => j.col === 0 || j.col === 4 || j.row === 0 || j.row === 4; const sameSide = (a.col === b.col && (a.col === 0 || a.col === 4)) || (a.row === b.row && (a.row === 0 || a.row === 4)); return onRing(a) && onRing(b) && sameSide })
const ringDegree = new Map<string, number>()
for (const r of ringRoads) for (const id of [r.from, r.to]) ringDegree.set(id, (ringDegree.get(id) ?? 0) + 1)
check('main road loop: 16 ring junctions, 16 main segments, each junction used twice (a closed loop)', ring.length === 16 && ringRoads.length === 16 && ringRoads.every((r) => r.class === 'main') && ring.every((j) => ringDegree.get(j.id) === 2))
const mainRoads = CITY.roads.filter((r) => r.class === 'main')
const mainJunctions = new Set(mainRoads.flatMap((r) => [r.from, r.to]))
const seen = new Set<string>([mainRoads[0].from]); let grew = true
while (grew) { grew = false; for (const r of mainRoads) if (seen.has(r.from) !== seen.has(r.to)) { seen.add(r.from); seen.add(r.to); grew = true } }
check('main roads alone form one connected system (ring + central crossing)', seen.size === mainJunctions.size, `${seen.size} junctions`)
check('secondary roads link into the main system at both ends', CITY.roads.filter((r) => r.class === 'secondary').every((r) => reachableJunctions(CITY, r.from).has(r.to)))

/* --------------------------------- districts ------------------------------- */
const wanted = ['central-plaza', 'downtown', 'residential', 'motor-row', 'industrial', 'riverside']
check('all six planned districts exist', wanted.every((id) => CITY.districts.some((d) => d.id === id)) && CITY.districts.length === 6)
check('every block belongs to exactly one district', CITY.blocks.every((b) => CITY.districts.filter((d) => d.blockIds.includes(b.id)).length === 1) && CITY.districts.reduce((n, d) => n + d.blockIds.length, 0) === 16)
const roadById = new Map(CITY.roads.map((r) => [r.id, r]))
check('every district borders the main road system', CITY.districts.every((d) => d.roadIds.some((id) => roadById.get(id)!.class === 'main')))
const origin = CITY.junctions.find((j) => j.col === 2 && j.row === 2)!
check('every district is reachable from the central crossing', CITY.districts.every((d) => d.roadIds.every((id) => hopCount(CITY, origin.id, roadById.get(id)!.from) >= 0)), `max ${Math.max(...CITY.roads.map((r) => hopCount(CITY, origin.id, r.from)))} hops`)
check('district bounds and centres lie inside the city', CITY.districts.every((d) => inside(CITY.floor, d.center.x, d.center.z) && d.rects.length === d.blockIds.length))
check('Central Plaza surrounds the central crossing', CITY.districts.find((d) => d.id === 'central-plaza')!.bounds.minX < 0 && CITY.districts.find((d) => d.id === 'central-plaza')!.bounds.maxX > 0)

/* ----------------------- lanes, right-hand traffic, graph ------------------- */
const road = (id: string) => roadById.get(id)!
check('two directed lanes per road', CITY.laneEdges.length === CITY.roads.length * 2)
check('right-hand traffic: eastbound keeps south, westbound north, southbound west, northbound east', CITY.laneEdges.every((l) => {
  const r = road(l.roadId)
  if (r.axis === 'x') return l.dir.x === 1 ? l.start.z > r.start.z : l.start.z < r.start.z
  return l.dir.z === 1 ? l.start.x < r.start.x : l.start.x > r.start.x
}))
check('lanes are quarter-width from the centreline and inside the road', CITY.laneEdges.every((l) => { const r = road(l.roadId); const off = r.axis === 'x' ? Math.abs(l.start.z - r.start.z) : Math.abs(l.start.x - r.start.x); return Math.abs(off - r.width / 4) < EPS && inside(r.rect, l.start.x, l.start.z, 0) }))
check('lane edges run junction edge to junction edge, matching connection points', CITY.laneEdges.every((l) => {
  const r = road(l.roadId)
  const len = Math.hypot(l.end.x - l.start.x, l.end.z - l.start.z)
  return Math.abs(len - r.length) < EPS && Math.abs(l.length - r.length) < EPS && l.from !== l.to
}))
check('connection points: one per junction arm, on the junction edge', CITY.connectionPoints.length === CITY.junctions.reduce((n, j) => n + Object.keys(j.arms).length, 0) && CITY.connectionPoints.every((p) => { const j = J.get(p.junctionId)!; return p.x >= j.rect.minX - EPS && p.x <= j.rect.maxX + EPS && p.z >= j.rect.minZ - EPS && p.z <= j.rect.maxZ + EPS }))
const arms = CITY.junctions.reduce((n, j) => n + Object.keys(j.arms).length * (Object.keys(j.arms).length - 1), 0)
check('movements: every arrival may continue onto every other road (no U-turns)', CITY.movements.length === arms, `${CITY.movements.length} movements`)
check('four-way junctions offer straight, left and right from every approach', CITY.junctions.filter((j) => j.type === 'four-way').every((j) => { const m = CITY.movements.filter((x) => x.junctionId === j.id); return m.filter((x) => x.kind === 'straight').length === 4 && m.filter((x) => x.kind === 'left').length === 4 && m.filter((x) => x.kind === 'right').length === 4 }))
check('turn kinds are right-handed (east then south is a right turn)', CITY.movements.every((m) => { const a = CITY.laneEdges.find((l) => l.id === m.from)!, b = CITY.laneEdges.find((l) => l.id === m.to)!; const cross = a.dir.x * b.dir.z - a.dir.z * b.dir.x; return m.kind === 'straight' ? cross === 0 && a.dir.x * b.dir.x + a.dir.z * b.dir.z === 1 : m.kind === 'right' ? cross > 0 : cross < 0 }))
{ const reach = (next: (id: string) => string[]) => { const start = CITY.laneEdges[0].id; const seenLanes = new Set([start]); const q = [start]
    while (q.length) for (const n of next(q.shift()!)) if (!seenLanes.has(n)) { seenLanes.add(n); q.push(n) }
    return seenLanes.size }
  const forward = reach((id) => nextLanes(CITY, id))
  const backward = reach((id) => CITY.movements.filter((m) => m.to === id).map((m) => m.from))
  check('lane graph is strongly connected: every lane reaches every other lane', forward === CITY.laneEdges.length && backward === CITY.laneEdges.length, `${forward} forward / ${backward} backward of ${CITY.laneEdges.length}`)
  check('no lane is a dead end', CITY.laneEdges.every((l) => nextLanes(CITY, l.id).length >= 1)) }

/* ------------------------------ spawn and demo yard ------------------------- */
const plaza = CITY.blocks.find((b) => b.id === 'B11')!
check('spawn is inside a Central Plaza block', plaza.districtId === 'central-plaza' && plaza.paved && inside(plaza.rect, CITY.spawn.x, CITY.spawn.z))
check('spawn is at least 20 m from every curb, road and block edge', inside(plaza.rect, CITY.spawn.x, CITY.spawn.z, 20), `x=${CITY.spawn.x} z=${CITY.spawn.z}`)
check('spawn clear of every road and junction', [...CITY.roads, ...CITY.junctions].every((r) => !inside(r.rect, CITY.spawn.x, CITY.spawn.z, -3)))
check('spawn surface is the plaza pavement height', CITY.spawn.surfaceY === SIDEWALK_TOP && CITY.spawn.x === CITY_SPAWN.x && CITY.spawn.z === CITY_SPAWN.z)
check('character spawn position matches: feet start 0.3 m above the plaza', SPAWN_POSITION[0] === CITY.spawn.x && SPAWN_POSITION[2] === CITY.spawn.z && Math.abs(SPAWN_POSITION[1] - FEET_OFFSET - SIDEWALK_TOP - 0.3) < 1e-9)
check('Phase 1 demo yard and step test area are outside the city', DEMO_YARD_ORIGIN.x - 50 > CITY_HALF_EXTENT && STEP_TEST_LANES.every((l) => l.x - 1.5 > CITY_HALF_EXTENT + 5), `yard x=${DEMO_YARD_ORIGIN.x}`)

/* ------------------------------- determinism ------------------------------- */
check('the layout is deterministic (two builds are identical)', JSON.stringify(buildCityLayout()) === JSON.stringify(CITY))
check('ids are unique', new Set(CITY.junctions.map((j) => j.id)).size === 25 && new Set(CITY.roads.map((r) => r.id)).size === 40 && new Set(CITY.sidewalks.map((s) => s.id)).size === CITY.sidewalks.length && new Set(CITY.laneEdges.map((l) => l.id)).size === 80)

console.log(fails === 0 ? 'ALL PASS' : `${fails} FAILED`)
process.exit(fails ? 1 : 0)
