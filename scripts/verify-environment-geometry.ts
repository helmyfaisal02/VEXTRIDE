/**
 * Verifies the environment's render geometry: valid buffers, correct winding
 * and outward-facing walls, buildings resting on the ground, draw-call and
 * triangle budgets, sign UVs, tree instancing data. Run with `bun run verify:environment-geometry`.
 */
import { Color, Vector3, type BufferGeometry } from 'three'
import { surfaceHeightAt } from '../src/game/city/citySurface'
import { GeometryBuilder } from '../src/game/city/geometryBuilder'
import { BUILDING_MODELS } from '../src/game/environment/buildingModels'
import { buildEnvironmentGeometry } from '../src/game/environment/envGeometry'
import { BUILDING_INFO, ENVIRONMENT } from '../src/game/environment/envLayout'
import { Frame } from '../src/game/environment/localFrame'
import { PAL } from '../src/game/environment/envPalette'
import { drawProp } from '../src/game/environment/propModels'

let fails = 0
const check = (name: string, ok: boolean, info = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${info}`)
  if (!ok) fails++
}
const t0 = performance.now()
const env = buildEnvironmentGeometry()
const buildMs = performance.now() - t0
const attr = (g: BufferGeometry, n: string) => g.getAttribute(n).array as Float32Array
const finite = (a: ArrayLike<number>) => Array.from(a).every(Number.isFinite)
const all = [...env.chunks.map((c) => [c.district, c.geometry] as const), ['paint-base', env.paintBase] as const, ['paint-lines', env.paintLines] as const, ['signs', env.signs.geometry] as const]

for (const [name, g] of all) {
  const pos = attr(g, 'position'), nrm = attr(g, 'normal'), idx = g.getIndex()!.array
  let unit = true, valid = true, wound = true
  for (let i = 0; i < nrm.length; i += 3) if (Math.abs(Math.hypot(nrm[i], nrm[i + 1], nrm[i + 2]) - 1) > 1e-5) unit = false
  for (const i of idx) if (i >= pos.length / 3) valid = false
  const p = (i: number) => new Vector3(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2])
  for (let t = 0; t < idx.length; t += 3) {
    const n = p(idx[t + 1]).sub(p(idx[t])).cross(p(idx[t + 2]).sub(p(idx[t])))
    if (n.dot(new Vector3(nrm[idx[t] * 3], nrm[idx[t] * 3 + 1], nrm[idx[t] * 3 + 2])) <= 0) wound = false
  }
  check(`${name}: finite, unit normals, valid indices, front faces match normals`, finite(pos) && finite(nrm) && unit && valid && wound, `${idx.length / 3} triangles`)
}

check('draw calls: 6 district meshes + 2 paint + 1 signs + 3 instanced tree meshes = 12', env.stats.drawCalls === 12)
check('triangle budget (< 40,000 for every building and prop)', env.stats.triangles < 40000, `${env.stats.triangles} triangles`)
check('geometry is built once, quickly (< 500 ms)', buildMs < 500, `${buildMs.toFixed(0)} ms`)
check('trees are instanced data, not meshes: round + conifer counts match the layout', env.trees.length === ENVIRONMENT.props.filter((p) => p.kind.startsWith('tree')).length && env.trees.length > 100, `${env.trees.length} instances`)
check('tree instances are sane (scale, finite, on a surface)', env.trees.every((t) => t.scale >= 0.8 && t.scale <= 1.4 && Number.isFinite(t.x + t.y + t.z) && (t.y === 0.03 || t.y === 0.16)))

/* ------------------------------ each building on its own ----------------------------- */
const glassColors = [PAL.glass, PAL.glassDeep, PAL.glassWarm, ...PAL.officeGlass].map((h) => new Color(h))
const isGlass = (r: number, g: number, bl: number) => glassColors.some((c) => Math.abs(c.r - r) < 1e-4 && Math.abs(c.g - g) < 1e-4 && Math.abs(c.b - bl) < 1e-4)
let allGrounded = true, glassTriangles = 0, glassOutward = 0, wallsFacing = 1
for (const info of BUILDING_INFO) {
  const b = new GeometryBuilder()
  BUILDING_MODELS[info.def.type](b, new Frame(info.def.x, info.def.z, info.def.facing), info.def)
  const g = b.build()
  const pos = attr(g, 'position'), nrm = attr(g, 'normal'), col = attr(g, 'color'), idx = g.getIndex()!.array
  if (Math.abs(g.boundingBox!.min.y) > 1e-6) allGrounded = false
  let mine = 0, mineOut = 0
  for (let t = 0; t < idx.length; t += 3) {
    const i = idx[t]
    if (!isGlass(col[i * 3], col[i * 3 + 1], col[i * 3 + 2]) || Math.abs(nrm[i * 3 + 1]) > 0.3) continue
    const cx = (pos[idx[t] * 3] + pos[idx[t + 1] * 3] + pos[idx[t + 2] * 3]) / 3 - info.def.x
    const cz = (pos[idx[t] * 3 + 2] + pos[idx[t + 1] * 3 + 2] + pos[idx[t + 2] * 3 + 2]) / 3 - info.def.z
    mine++
    if (nrm[i * 3] * cx + nrm[i * 3 + 2] * cz > 0) mineOut++
  }
  glassTriangles += mine
  glassOutward += mineOut
  wallsFacing = Math.min(wallsFacing, mine === 0 ? 1 : mineOut / mine)
}
check('every building rests on y = 0 (no floating structures)', allGrounded)
check('every window pane faces away from its building, on all four street orientations', glassTriangles > 1000 && glassOutward === glassTriangles, `${glassTriangles} glass triangles, worst building ${(wallsFacing * 100).toFixed(1)}% outward`)

/* --------------------------------- props rest on surfaces ------------------------------ */
{ let floating = 0
  for (const p of ENVIRONMENT.props.filter((q) => !q.kind.startsWith('tree'))) {
    const b = new GeometryBuilder()
    const y = surfaceHeightAt(p.x, p.z) || 0.03
    drawProp(b, p, y)
    const g = b.build()
    if (g.getIndex()!.count === 0) continue
    if (Math.abs(g.boundingBox!.min.y - y) > 1e-6) floating++
  }
  check('every prop stands exactly on the surface under it', floating === 0, `${floating} floating`) }

/* ------------------------------------ signs --------------------------------------- */
{ const uv = attr(env.signs.geometry, 'uv')
  const signCount = BUILDING_INFO.reduce((n, i) => n + i.signs.length, 0)
  check('one sign quad per sign, with UVs inside the atlas', env.signs.entries.length === signCount && uv.length / 2 === signCount * 4 && Array.from(uv).every((v) => v >= 0 && v <= 1), `${signCount} signs`)
  check('every sign has text, a board colour and a plausible shape', env.signs.entries.every((e) => e.text.length >= 3 && /^#/.test(e.board) && e.aspect > 2 && e.aspect < 16)) }
{ const pos = attr(env.signs.geometry, 'position'), nrm = attr(env.signs.geometry, 'normal')
  let ok = true
  BUILDING_INFO.flatMap((i) => i.signs.map(() => i)).forEach((info, k) => {
    const cx = (pos[k * 12] + pos[k * 12 + 6]) / 2 - info.def.x, cz = (pos[k * 12 + 2] + pos[k * 12 + 8]) / 2 - info.def.z
    if (nrm[k * 12] * cx + nrm[k * 12 + 2] * cz <= 0) ok = false
  })
  check('signs face outward, toward the street', ok) }

console.log(fails === 0 ? 'ALL PASS' : `${fails} FAILED`)
process.exit(fails ? 1 : 0)
