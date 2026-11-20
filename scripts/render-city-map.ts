/**
 * Renders a top-down PNG of the city layout (surfaces and road paint) to
 * docs/city-layout.png, for reviewing the road network without a browser.
 * Run with `bun run city:map`. The red square is the player spawn.
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import { CITY } from '../src/game/city/cityLayout'
import { buildCityGeometries } from '../src/game/city/cityGeometry'
import { DISTRICT_COLORS, SURFACE_COLORS } from '../src/game/city/cityConfig'
const S = 3, N = 360 * S, off = 180
const img = new Uint8Array(N * N * 3)
const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const fill = (r: { minX: number; maxX: number; minZ: number; maxZ: number }, c: number[]) => {
  for (let z = Math.floor((r.minZ + off) * S); z < Math.ceil((r.maxZ + off) * S); z++) for (let x = Math.floor((r.minX + off) * S); x < Math.ceil((r.maxX + off) * S); x++) { const i = (z * N + x) * 3; img[i] = c[0]; img[i + 1] = c[1]; img[i + 2] = c[2] }
}
fill({ minX: -180, maxX: 180, minZ: -180, maxZ: 180 }, hex('#7fa36a'))
for (const j of CITY.junctions) fill(j.rect, hex(SURFACE_COLORS.asphalt))
for (const r of CITY.roads) fill(r.rect, hex(SURFACE_COLORS.asphalt))
for (const b of CITY.blocks) if (b.lot) fill(b.lot, hex(DISTRICT_COLORS[b.districtId]))
for (const s of CITY.sidewalks) fill(s.rect, s.side === 'plaza' ? hex(SURFACE_COLORS.plaza) : hex(SURFACE_COLORS.sidewalk))
const m = buildCityGeometries().markings
const pos = m.getAttribute('position').array as Float32Array, col = m.getAttribute('color').array as Float32Array
for (let i = 0; i < pos.length / 3; i += 4) {
  const xs = [0, 1, 2, 3].map((k) => pos[(i + k) * 3]), zs = [0, 1, 2, 3].map((k) => pos[(i + k) * 3 + 2])
  const yellow = col[i * 3 + 2] < 0.2 * 1 && col[i * 3] > 0.5
  fill({ minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) }, yellow ? [240, 195, 60] : [245, 245, 240])
}
// environment: paint, buildings, props
import { ENVIRONMENT } from '../src/game/environment/envLayout'
for (const p of ENVIRONMENT.paint) fill(p.rect, hex(p.color))
const KIND_COLOR: Record<string, number[]> = { streetlight: [255, 240, 120], 'tree-round': [40, 120, 50], 'tree-conifer': [20, 80, 50], bench: [150, 100, 60], bin: [60, 90, 70], planter: [230, 100, 140], fence: [250, 250, 250], container: [210, 90, 60], monument: [20, 160, 150], shelter: [60, 140, 90], 'stop-sign': [220, 40, 40] }
for (const c of ENVIRONMENT.colliders) {
  const prop = ENVIRONMENT.props.find((p) => c.id.startsWith(p.id))
  const big = !prop
  fill(c.rect, big ? [90, 60, 50] : (KIND_COLOR[prop.kind] ?? [200, 200, 200]))
}
// spawn marker
fill({ minX: CITY.spawn.x - 1.5, maxX: CITY.spawn.x + 1.5, minZ: CITY.spawn.z - 1.5, maxZ: CITY.spawn.z + 1.5 }, [220, 40, 40])
const raw = Buffer.alloc((N * 3 + 1) * N)
for (let y = 0; y < N; y++) { raw[y * (N * 3 + 1)] = 0; Buffer.from(img.buffer, y * N * 3, N * 3).copy(raw, y * (N * 3 + 1) + 1) }
const crcT = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
const crc = (b: Buffer) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
const chunk = (t: string, d: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]) }
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(N, 0); ihdr.writeUInt32BE(N, 4); ihdr[8] = 8; ihdr[9] = 2
writeFileSync('docs/city-layout.png', Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]))
console.log('ok')
