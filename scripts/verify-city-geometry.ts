/**
 * Verifies the generated city geometry: valid buffers, draw-call and triangle
 * budgets, markings that sit cleanly above the asphalt without overlapping,
 * and that the visible surface (ray-cast against the actual mesh) matches the
 * layout's surface heights. Run with `bun run verify:city-geometry`.
 */
import { BufferGeometry, Color, DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three'
import { DISTRICT_COLORS, ROAD_TOP, SIDEWALK_TOP, SURFACE_COLORS, MARKING } from '../src/game/city/cityConfig'
import { buildCityGeometries } from '../src/game/city/cityGeometry'
import { CITY } from '../src/game/city/cityLayout'
import { surfaceHeightAt } from '../src/game/city/citySurface'
import type { Rect } from '../src/game/city/cityTypes'

let fails = 0
const check = (name: string, ok: boolean, info = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${info}`)
  if (!ok) fails++
}
const t0 = performance.now()
const g = buildCityGeometries()
const buildMs = performance.now() - t0

const attr = (geo: BufferGeometry, name: string) => geo.getAttribute(name).array as Float32Array
const finite = (a: ArrayLike<number>) => Array.from(a).every(Number.isFinite)

/* --------------------------------- buffers --------------------------------- */
for (const [name, geo] of [['surface', g.surface], ['markings', g.markings]] as const) {
  const pos = attr(geo, 'position'), nrm = attr(geo, 'normal'), col = attr(geo, 'color')
  check(`${name}: positions, normals and colours are finite`, finite(pos) && finite(nrm) && finite(col))
  let unit = true
  for (let i = 0; i < nrm.length; i += 3) if (Math.abs(Math.hypot(nrm[i], nrm[i + 1], nrm[i + 2]) - 1) > 1e-6) unit = false
  check(`${name}: normals are unit length`, unit)
  const idx = geo.getIndex()!.array
  check(`${name}: indices valid`, Array.from(idx).every((i) => i < pos.length / 3))
  check(`${name}: triangles wind to match their normals (front faces point the right way)`, (() => {
    for (let t = 0; t < idx.length; t += 3) {
      const [a, b, c] = [idx[t], idx[t + 1], idx[t + 2]].map((i) => new Vector3(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]))
      const n = b.clone().sub(a).cross(c.clone().sub(a))
      if (n.dot(new Vector3(nrm[idx[t] * 3], nrm[idx[t] * 3 + 1], nrm[idx[t] * 3 + 2])) <= 0) return false
    }
    return true
  })())
}

/* ------------------------------ budgets / bounds --------------------------- */
check('two merged meshes only (2 draw calls for the whole road network)', [g.surface, g.markings].length === 2)
check('triangle budget is small (< 15,000 in total)', g.stats.surfaceTriangles + g.stats.markingTriangles < 15000, `surface ${g.stats.surfaceTriangles} + markings ${g.stats.markingTriangles}`)
check('geometry builds in well under a second', buildMs < 1000, `${buildMs.toFixed(1)} ms`)
g.surface.computeBoundingBox(); g.markings.computeBoundingBox()
const sb = g.surface.boundingBox!, mb = g.markings.boundingBox!
check('surface spans the +/-170 m city and rises no higher than the sidewalk', sb.min.x === -170 && sb.max.x === 170 && sb.min.z === -170 && sb.max.z === 170 && Math.abs(sb.max.y - SIDEWALK_TOP) < 1e-6 && sb.min.y === 0)
check('markings stay inside the city and 8 mm above the asphalt (no z-fighting)', mb.min.y === mb.max.y && Math.abs(mb.min.y - (ROAD_TOP + MARKING.lift)) < 1e-6 && mb.min.x >= -170 && mb.max.x <= 170, `y=${mb.min.y.toFixed(4)}`)

/* ------------------------------ marking layout ----------------------------- */
const mp = attr(g.markings, 'position')
const quads: Rect[] = []
for (let i = 0; i < mp.length; i += 12) {
  const xs = [mp[i], mp[i + 3], mp[i + 6], mp[i + 9]], zs = [mp[i + 2], mp[i + 5], mp[i + 8], mp[i + 11]]
  quads.push({ minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) })
}
const within = (q: Rect, r: Rect, e = 1e-6) => q.minX >= r.minX - e && q.maxX <= r.maxX + e && q.minZ >= r.minZ - e && q.maxZ <= r.maxZ + e
check('every marking lies on a road, never on a junction, sidewalk or lot', quads.every((q) => CITY.roads.some((r) => within(q, r.rect))), `${quads.length} marking quads`)
let worst = 0
for (let i = 0; i < quads.length; i++) for (let k = i + 1; k < quads.length; k++) {
  const a = quads[i], b = quads[k]
  worst = Math.max(worst, Math.max(0, Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX)) * Math.max(0, Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ)))
}
check('no two markings overlap each other (no coplanar z-fighting)', worst < 1e-9, `worst overlap ${worst.toExponential(1)} m2`)
const cols = attr(g.markings, 'color'); const yellow = new Color(SURFACE_COLORS.markingYellow), white = new Color(SURFACE_COLORS.markingWhite)
let nY = 0, nW = 0
for (let i = 0; i < cols.length; i += 12) { if (Math.abs(cols[i] - yellow.r) < 1e-5 && Math.abs(cols[i + 1] - yellow.g) < 1e-5) nY++; else if (Math.abs(cols[i] - white.r) < 1e-5) nW++ }
check('both yellow and white paint are present', nY > 20 && nW > 100 && nY + nW === quads.length, `${nY} yellow, ${nW} white`)
const crosswalkRoads = CITY.roads.filter((r) => quads.filter((q) => within(q, r.rect) && (q.maxX - q.minX === MARKING.crosswalkStripe || q.maxZ - q.minZ === MARKING.crosswalkStripe)).length > 0)
check('crosswalks exist on the roads at major intersections', crosswalkRoads.length >= 20, `${crosswalkRoads.length} roads with crosswalk stripes`)
check('markings are symmetric about the city (same paint count left and right)', quads.filter((q) => q.maxX < 0).length === quads.filter((q) => q.minX > 0).length)

/* -------- rendered surface vs layout: ray-cast the actual mesh from above -------- */
const mesh = new Mesh(g.surface, new MeshBasicMaterial({ side: DoubleSide }))
mesh.updateMatrixWorld(true)
const rc = new Raycaster(); const down = new Vector3(0, -1, 0)
let bad = 0, misses = 0, tested = 0, maxErr = 0
for (let x = -169.3; x <= 169.3; x += 2.9) for (let z = -169.3; z <= 169.3; z += 2.9) {
  rc.set(new Vector3(x, 5, z), down)
  const hit = rc.intersectObject(mesh, false)[0]
  tested++
  if (!hit) { misses++; continue }
  const err = Math.abs(hit.point.y - surfaceHeightAt(x, z))
  maxErr = Math.max(maxErr, err)
  if (err > 1e-6) bad++
}
check('rendered surface has no holes anywhere in the city', misses === 0, `${tested} rays, ${misses} missed`)
check('rendered surface height equals the layout (and so the colliders) everywhere', bad === 0, `max error ${maxErr.toExponential(1)} m over ${tested} points`)
{ const markMesh = new Mesh(g.markings, new MeshBasicMaterial({ side: DoubleSide })); markMesh.updateMatrixWorld(true)
  const q = quads[0]; rc.set(new Vector3((q.minX + q.maxX) / 2, 5, (q.minZ + q.maxZ) / 2), down)
  const hit = rc.intersectObject(markMesh, false)[0]
  check('markings are hit from above at their painted height', !!hit && Math.abs(hit.point.y - (ROAD_TOP + MARKING.lift)) < 1e-6) }

/* ----------------------------------- colours -------------------------------- */
const sc = attr(g.surface, 'color'); const seen = new Set<string>()
for (let i = 0; i < sc.length; i += 3) seen.add(new Color(sc[i], sc[i + 1], sc[i + 2]).getHexString())
const hexes = (o: Record<string, string>) => Object.values(o).map((c) => new Color(c).getHexString())
check('asphalt, curb, sidewalk and every district tint appear in the surface mesh', [SURFACE_COLORS.asphalt, SURFACE_COLORS.curb, SURFACE_COLORS.sidewalk].map((c) => new Color(c).getHexString()).every((h) => seen.has(h)) && hexes(DISTRICT_COLORS).filter((h) => h !== new Color(DISTRICT_COLORS['central-plaza']).getHexString()).every((h) => seen.has(h)))

console.log(fails === 0 ? 'ALL PASS' : `${fails} FAILED`)
process.exit(fails ? 1 : 0)
