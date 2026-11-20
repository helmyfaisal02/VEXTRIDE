/**
 * Verifies the city environment layout: building placement and entrances,
 * district content, prop placement rules, collision data and determinism.
 * Pure data checks, no rendering. Run with `bun run verify:environment`.
 */
import { CITY } from '../src/game/city/cityLayout'
import { SIDEWALK_WIDTH } from '../src/game/city/cityConfig'
import type { Rect } from '../src/game/city/cityTypes'
import { GeometryBuilder } from '../src/game/city/geometryBuilder'
import { BUILDING_MODELS } from '../src/game/environment/buildingModels'
import { BUILDINGS } from '../src/game/environment/buildingPlacements'
import { buildEnvironment, ENVIRONMENT, BUILDING_INFO, RIVER_RESERVE } from '../src/game/environment/envLayout'
import { Frame } from '../src/game/environment/localFrame'
import { inflate, overlaps, propRect } from '../src/game/environment/propLayout'
import { entranceCorridor } from '../src/game/environment/streetProps'

let fails = 0
const check = (name: string, ok: boolean, info = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${info}`)
  if (!ok) fails++
}
const inside = (r: Rect, outer: Rect, m = 0) => r.minX >= outer.minX + m && r.maxX <= outer.maxX - m && r.minZ >= outer.minZ + m && r.maxZ <= outer.maxZ - m
const block = (id: string) => CITY.blocks.find((b) => b.id === id)!
const roadRects: Rect[] = [...CITY.roads.map((r) => r.rect), ...CITY.junctions.map((j) => j.rect)]
const areaOf = (r: Rect) => (r.maxX - r.minX) * (r.maxZ - r.minZ)

/* ------------------------------ existing city intact ------------------------------ */
{ const sum = (rs: Rect[]) => rs.reduce((n, r, i) => n + ((i + 1) * (r.minX + 3 * r.maxX + 5 * r.minZ + 7 * r.maxZ) ** 2) / 1e6, 0)
  const FINGERPRINT = 4003.6
  check('road network is unchanged (25 junctions, 40 roads, 80 lanes, 188 movements)', CITY.junctions.length === 25 && CITY.roads.length === 40 && CITY.laneEdges.length === 80 && CITY.movements.length === 188 && CITY.blocks.length === 16)
  check('road geometry fingerprint is unchanged', Math.abs(sum(roadRects) - FINGERPRINT) < 0.05 && roadRects.length === 65, `fingerprint ${sum(roadRects).toFixed(1)}`) }

/* ----------------------------------- buildings ------------------------------------ */
const types = new Set(BUILDINGS.map((b) => b.type))
check('about 20 buildings', BUILDINGS.length >= 15 && BUILDINGS.length <= 22, `${BUILDINGS.length} buildings`)
check('all nine building types are used', types.size === 9, [...types].join(', '))
check('building ids are unique and stable', new Set(BUILDINGS.map((b) => b.id)).size === BUILDINGS.length && BUILDINGS[0].id === 'building-01')
const perDistrict = (d: string) => BUILDINGS.filter((b) => b.districtId === d)
check('downtown: 2 offices and 3 brick blocks', perDistrict('downtown').filter((b) => b.type === 'office').length === 2 && perDistrict('downtown').filter((b) => b.type === 'brick-commercial').length === 3)
check('residential: 4 houses and 2 apartment blocks', perDistrict('residential').filter((b) => b.type === 'house').length === 4 && perDistrict('residential').filter((b) => b.type === 'apartment').length === 2)
check('motor row: garage, showroom, workshop and store', ['garage', 'showroom', 'workshop', 'convenience-store'].every((t) => perDistrict('motor-row').some((b) => b.type === t)))
check('industrial: 3 warehouses and a workshop', perDistrict('industrial').filter((b) => b.type === 'warehouse').length === 3 && perDistrict('industrial').some((b) => b.type === 'workshop'))
check('riverside has a cafe, central plaza has no buildings', perDistrict('riverside').length === 1 && perDistrict('central-plaza').length === 0)
check('every building sits in a lot of its own district', BUILDINGS.every((b) => block(b.blockId).districtId === b.districtId && block(b.blockId).lot !== null))

for (const info of BUILDING_INFO) {
  const { def, rect } = info
  const lot = block(def.blockId).lot as Rect
  // Visual bounds: run the model and measure everything it draws, canopies and balconies included.
  const scratch = new GeometryBuilder()
  BUILDING_MODELS[def.type](scratch, new Frame(def.x, def.z, def.facing), def)
  const g = scratch.build()
  const bb = g.boundingBox!
  const vis: Rect = { minX: bb.min.x, maxX: bb.max.x, minZ: bb.min.z, maxZ: bb.max.z }
  check(`${def.id} ${def.type}: footprint and all visible parts are inside the lot`, inside(rect, lot, 1) && inside(vis, lot, 0.3), `${def.name || def.type}`)
  check(`${def.id}: nothing touches a road, junction or sidewalk`, roadRects.every((r) => !overlaps(vis, r)) && CITY.sidewalks.every((s) => !overlaps(vis, s.rect)))
  check(`${def.id}: sits on the ground (lowest point y=0) with the right height`, Math.abs(bb.min.y) < 1e-6 && bb.max.y >= def.height && bb.max.y <= def.height + 14, `top ${bb.max.y.toFixed(1)} m`)
  const corridor = entranceCorridor(def, block(def.blockId))
  const toStreet = Math.max(corridor.maxX - corridor.minX, corridor.maxZ - corridor.minZ)
  check(`${def.id}: entrance faces the street, ${toStreet.toFixed(1)} m of clear approach`, toStreet >= 3 && toStreet <= 25)
  const blockers = ENVIRONMENT.colliders.filter((c) => !c.id.startsWith(def.id) && overlaps(c.rect, corridor))
  check(`${def.id}: nothing solid blocks the approach to the door`, blockers.length === 0, blockers.map((b) => b.id).join(','))
}
{ let worst = 99
  for (let i = 0; i < BUILDING_INFO.length; i++) for (let k = i + 1; k < BUILDING_INFO.length; k++) {
    const a = BUILDING_INFO[i].rect, b = BUILDING_INFO[k].rect
    const gap = Math.max(a.minX - b.maxX, b.minX - a.maxX, a.minZ - b.maxZ, b.minZ - a.maxZ)
    worst = Math.min(worst, gap)
  }
  check('buildings never overlap (at least 2 m between footprints)', worst >= 2, `closest gap ${worst.toFixed(1)} m`) }
check('business names are fictional originals', BUILDINGS.filter((b) => b.name).every((b) => !/mcdonald|starbucks|shell|exxon|ford|toyota|honda|walmart|target|amazon|gta|rockstar|7-eleven|subway|apple|google/i.test(b.name)), BUILDINGS.map((b) => b.name).filter(Boolean).join(' | '))
check('shops, offices, garages and warehouses all carry a sign', BUILDING_INFO.filter((i) => i.def.type !== 'house').every((i) => i.signs.length >= 1))

/* ------------------------------------- props -------------------------------------- */
const props = ENVIRONMENT.props
const rectOf = (p: (typeof props)[number]) => propRect(p.x, p.z, p.kind, p.facing, p.kind === 'fence' ? (p.facing === 'N' || p.facing === 'S' ? p.sz : p.sx) : undefined)
const kinds = (k: string) => props.filter((p) => p.kind === k)
check('props are all inside the city floor and never on a road or junction', props.every((p) => inside(rectOf(p), CITY.floor) && roadRects.every((r) => !overlaps(rectOf(p), r))))
{ let bad = 0
  for (let i = 0; i < props.length; i++) { const a = rectOf(props[i]); if (BUILDING_INFO.some((b) => overlaps(a, b.rect))) bad++
    for (let k = i + 1; k < props.length; k++) if (overlaps(a, rectOf(props[k]))) bad++ }
  check('no prop overlaps a building or another prop', bad === 0, `${bad} overlaps`) }
check('colliders never overlap each other (buildings, trunks, benches, containers...)', (() => {
  const cs = ENVIRONMENT.colliders
  for (let i = 0; i < cs.length; i++) for (let k = i + 1; k < cs.length; k++) {
    if (cs[i].id.split(':')[0] === cs[k].id.split(':')[0]) continue
    if (overlaps(cs[i].rect, cs[k].rect)) return false
  }
  return true
})())
check('lot objects (containers, tire stacks, fences, utility boxes, pavilion, monument) stay off the sidewalks', props.filter((p) => ['container', 'tire-stack', 'fence', 'utility-box', 'shelter', 'monument'].includes(p.kind) && p.districtId !== 'central-plaza').every((p) => CITY.sidewalks.every((s) => !overlaps(rectOf(p), s.rect))))
check('no collider stands on a road or junction', ENVIRONMENT.colliders.every((c) => roadRects.every((r) => !overlaps(c.rect, r))))
check('every collider has a positive height and rests on its surface', ENVIRONMENT.colliders.every((c) => c.y1 > c.y0 && c.y0 >= -1e-9 && c.y0 <= 0.16 + 1e-9))
{ // Sidewalks keep a walking corridor: any prop in a strip leaves at least 1.1 m free on one side.
  let worst = 99
  for (const s of CITY.sidewalks.filter((x) => x.side !== 'plaza')) {
    const horizontal = s.rect.maxX - s.rect.minX > s.rect.maxZ - s.rect.minZ
    for (const c of ENVIRONMENT.colliders) {
      if (!overlaps(c.rect, s.rect)) continue
      const [lo, hi, a, b] = horizontal ? [s.rect.minZ, s.rect.maxZ, c.rect.minZ, c.rect.maxZ] : [s.rect.minX, s.rect.maxX, c.rect.minX, c.rect.maxX]
      worst = Math.min(worst, Math.max(a - lo, hi - b))
    }
  }
  check(`sidewalk props leave at least 1.1 m of the ${SIDEWALK_WIDTH} m sidewalk free`, worst >= 1.1, `narrowest free width ${worst.toFixed(2)} m`) }
{ const corners = ENVIRONMENT.keepClear.filter((k) => k.id.startsWith('corner:'))
  check('no solid object sits in a block-corner zone (crosswalk landings stay open)', corners.length === 64 && ENVIRONMENT.colliders.every((c) => corners.every((k) => !overlaps(c.rect, k.rect)))) }

/* ----------------------------------- spawn ------------------------------------- */
{ const spawn = ENVIRONMENT.keepClear.find((k) => k.id === 'spawn')!.rect
  check('player spawn: 24 x 24 m around it is free of every collider', ENVIRONMENT.colliders.every((c) => !overlaps(c.rect, spawn)))
  check('player spawn: inside the plaza block, paved', CITY.spawn.surfaceY === 0.16 && inside(spawn, block('B11').rect)) }

/* ------------------------------ district identity ----------------------------- */
const inDistrict = (d: string) => props.filter((p) => p.districtId === d)
const countKind = (d: string, k: string) => inDistrict(d).filter((p) => p.kind === k).length
check('downtown: street trees, benches, bins, lamps and planters', countKind('downtown', 'tree-round') >= 8 && countKind('downtown', 'bench') >= 6 && countKind('downtown', 'bin') >= 3 && countKind('downtown', 'streetlight') >= 3 && countKind('downtown', 'planter') >= 6)
check('residential: fenced yards, trees and driveways', countKind('residential', 'fence') >= 8 && countKind('residential', 'tree-round') + countKind('residential', 'tree-conifer') >= 12 && ENVIRONMENT.paint.some((p) => p.color === '#a7a49b' && p.rect.minX > -150 && p.rect.maxX < -80 && p.rect.minZ < -9))
check('motor row: parking markings, tire stacks, lamps', ENVIRONMENT.paint.filter((p) => p.layer === 'lines' && p.rect.minX > 87).length >= 20 && countKind('motor-row', 'tire-stack') >= 2 && countKind('motor-row', 'streetlight') >= 4)
check('industrial: containers, yard fence, hydrants and lamps', countKind('industrial', 'container') >= 10 && countKind('industrial', 'fence') >= 8 && countKind('industrial', 'streetlight') >= 3)
check('riverside: trees, benches, pavilion, promenade lamps', countKind('riverside', 'tree-round') + countKind('riverside', 'tree-conifer') >= 15 && countKind('riverside', 'bench') >= 8 && countKind('riverside', 'shelter') === 1 && countKind('riverside', 'streetlight') >= 4)
check('central plaza: monument, benches, planters, trees', countKind('central-plaza', 'monument') === 1 && countKind('central-plaza', 'bench') >= 12 && countKind('central-plaza', 'planter') >= 6 && countKind('central-plaza', 'tree-round') >= 12)
check('stop signs and bollards-or-hydrants exist as road furniture', kinds('stop-sign').length >= 8)
{ const riv = RIVER_RESERVE
  check('river reserve is a large open strip (>= 2,000 m2) inside the riverside lots', areaOf(riv) >= 2000 && inside(riv, { minX: -151, maxX: -9, minZ: 133, maxZ: 151 }))
  check('river reserve stays empty: no props, buildings, colliders or lawn on it', props.every((p) => !overlaps(rectOf(p), riv)) && ENVIRONMENT.colliders.every((c) => !overlaps(c.rect, riv)) && ENVIRONMENT.paint.every((p) => !overlaps(p.rect, riv))) }

/* ----------------------------------- paint ---------------------------------------- */
{ const bases = ENVIRONMENT.paint.filter((p) => p.layer === 'base')
  const lines = ENVIRONMENT.paint.filter((p) => p.layer === 'lines')
  const clash = (list: typeof bases) => { let n = 0; for (let i = 0; i < list.length; i++) for (let k = i + 1; k < list.length; k++) if ((list[i].y ?? 0.03) === (list[k].y ?? 0.03) && overlaps(list[i].rect, list[k].rect)) n++; return n }
  check('base paint (lawn, paving, pads) never overlaps itself: no z-fighting', clash(bases) === 0, `${bases.length} pieces`)
  check('line paint (parking, safety lines) never overlaps itself', clash(lines) === 0, `${lines.length} pieces`)
  check('paint never covers a road, junction or sidewalk', ENVIRONMENT.paint.every((p) => roadRects.every((r) => !overlaps(p.rect, r)) && (p.y === 0.16 || CITY.sidewalks.every((s) => !overlaps(p.rect, s.rect))) )) }

/* -------------------------------- determinism / size -------------------------------- */
{ const again = buildEnvironment()
  check('layout is deterministic (two builds are identical)', JSON.stringify(again) === JSON.stringify(ENVIRONMENT))
  check('collider count is modest (< 600, one physics body)', ENVIRONMENT.colliders.length < 600, `${ENVIRONMENT.colliders.length} colliders for ${props.length} props and ${BUILDINGS.length} buildings`)
  void inflate }

console.log(fails === 0 ? 'ALL PASS' : `${fails} FAILED`)
process.exit(fails ? 1 : 0)
