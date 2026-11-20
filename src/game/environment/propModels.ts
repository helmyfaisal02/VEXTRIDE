import type { GeometryBuilder } from '../city/geometryBuilder'
import { lbox } from './buildingParts'
import { PAL, pick } from './envPalette'
import type { PropDef } from './envTypes'
import { Frame } from './localFrame'

/**
 * Procedural street props, drawn into the district's merged geometry. Each is
 * written in the prop's own frame (u across, v toward its front) so it can
 * face any street. Trees are not drawn here; they are instanced separately.
 */

type Draw = (b: GeometryBuilder, f: Frame, p: PropDef, y: number) => void

const box = (b: GeometryBuilder, f: Frame, u0: number, u1: number, y0: number, y1: number, v0: number, v1: number, color: string) => lbox(b, f, u0, u1, y0, y1, v0, v1, color)

const streetlight: Draw = (b, f, _p, y) => {
  box(b, f, -0.17, 0.17, y, y + 0.45, -0.17, 0.17, PAL.metalDark)
  box(b, f, -0.07, 0.07, y + 0.45, y + 6.3, -0.07, 0.07, PAL.lampPole)
  // Arm reaching over the street, then the lamp head.
  box(b, f, -0.05, 0.05, y + 6.2, y + 6.32, 0, 1.5, PAL.lampPole)
  box(b, f, -0.28, 0.28, y + 6.05, y + 6.2, 1.1, 1.8, PAL.metal)
  box(b, f, -0.2, 0.2, y + 6.0, y + 6.05, 1.2, 1.7, PAL.lampGlow)
}

const bench: Draw = (b, f, p, y) => {
  const wood = pick([PAL.wood, PAL.woodLight], p.variant)
  box(b, f, -0.95, 0.95, y + 0.42, y + 0.5, -0.3, 0.3, wood)
  box(b, f, -0.95, 0.95, y + 0.55, y + 0.9, -0.3, -0.22, wood)
  for (const u of [-0.8, 0.8]) box(b, f, u - 0.05, u + 0.05, y, y + 0.9, -0.3, 0.3, PAL.metalDark)
}

const bin: Draw = (b, f, p, y) => {
  box(b, f, -0.25, 0.25, y, y + 0.85, -0.25, 0.25, pick(['#4f7a58', '#3b5f8a', '#58606b'], p.variant))
  box(b, f, -0.29, 0.29, y + 0.85, y + 0.95, -0.29, 0.29, PAL.metalDark)
}

const planter: Draw = (b, f, p, y) => {
  box(b, f, -1.2, 1.2, y, y + 0.55, -0.47, 0.47, PAL.planterShell)
  box(b, f, -1.1, 1.1, y + 0.55, y + 0.62, -0.37, 0.37, PAL.planterSoil)
  for (let i = 0; i < 6; i++) {
    const u = -0.95 + i * 0.38
    box(b, f, u - 0.14, u + 0.14, y + 0.62, y + 0.62 + 0.28 + ((i + p.variant) % 3) * 0.07, -0.16 + (i % 2) * 0.18, 0.16 + (i % 2) * 0.18, pick(PAL.flower, i + p.variant))
  }
}

const stopSign: Draw = (b, f, _p, y) => {
  box(b, f, -0.04, 0.04, y, y + 2.5, -0.04, 0.04, PAL.signPole)
  const cy = y + 2.35
  const r = 0.38
  const pts: Array<[number, number]> = Array.from({ length: 8 }, (_, i) => [Math.cos((i + 0.5) * (Math.PI / 4)) * r, Math.sin((i + 0.5) * (Math.PI / 4)) * r])
  for (let i = 0; i < 8; i++) {
    const a = pts[i]
    const c = pts[(i + 1) % 8]
    b.tri(f.pt(0, cy, 0.07), f.pt(a[0], cy + a[1], 0.07), f.pt(c[0], cy + c[1], 0.07), PAL.stopRed, f.normal(0, 0, 1))
  }
  box(b, f, -0.26, 0.26, cy - 0.04, cy + 0.04, 0.071, 0.08, PAL.frameWhite)
}

const fence: Draw = (b, f, p, y) => {
  const half = (p.facing === 'N' || p.facing === 'S' ? p.sz : p.sx) / 2
  if (p.variant === 2) {
    // Stone riverbank wall with a capstone.
    box(b, f, -0.18, 0.18, y, y + 0.85, -half, half, '#9a978e')
    box(b, f, -0.24, 0.24, y + 0.85, y + 0.95, -half, half, '#b6b3a8')
    return
  }
  const metal = p.variant === 1
  const h = metal ? 2.0 : 1.1
  const post = metal ? PAL.metalDark : PAL.frameWhite
  for (const v of [-half + 0.05, half - 0.05]) box(b, f, -0.06, 0.06, y, y + h + 0.05, v - 0.06, v + 0.06, post)
  for (const ry of metal ? [0.15, h * 0.5, h] : [0.3, h - 0.15]) box(b, f, -0.04, 0.04, y + ry, y + ry + 0.08, -half, half, post)
  if (!metal) {
    const n = Math.max(2, Math.round((half * 2) / 0.4))
    for (let i = 0; i < n; i++) {
      const v = -half + 0.15 + ((half * 2 - 0.3) * i) / (n - 1)
      for (const u of [0.05, -0.05]) b.quad(f.pt(u, y, v - 0.05), f.pt(u, y, v + 0.05), f.pt(u, y + h, v + 0.05), f.pt(u, y + h, v - 0.05), f.normal(Math.sign(u), 0, 0), post)
    }
  }
}

const container: Draw = (b, f, p, y) => {
  const color = pick(PAL.container, p.variant)
  const stacks = p.height > 3 ? 2 : 1
  for (let s = 0; s < stacks; s++) {
    const tint = s === 0 ? color : pick(PAL.container, p.variant + 2)
    box(b, f, -1.2, 1.2, y + s * 2.6, y + (s + 1) * 2.6, -3.0, 3.0, tint)
    for (let v = -2.7; v < 2.8; v += 0.6) for (const sgn of [1, -1]) b.quad(f.pt(sgn * 1.21, y + s * 2.6 + 0.1, v), f.pt(sgn * 1.21, y + s * 2.6 + 0.1, v + 0.2), f.pt(sgn * 1.21, y + (s + 1) * 2.6 - 0.1, v + 0.2), f.pt(sgn * 1.21, y + (s + 1) * 2.6 - 0.1, v), f.normal(sgn, 0, 0), PAL.metalDark)
    for (const sv of [1, -1]) b.quad(f.pt(-1, y + s * 2.6 + 0.1, sv * 3.01), f.pt(1, y + s * 2.6 + 0.1, sv * 3.01), f.pt(1, y + (s + 1) * 2.6 - 0.1, sv * 3.01), f.pt(-1, y + (s + 1) * 2.6 - 0.1, sv * 3.01), f.normal(0, 0, sv), PAL.metalDark)
  }
}

const hydrant: Draw = (b, f, _p, y) => {
  box(b, f, -0.16, 0.16, y, y + 0.7, -0.16, 0.16, '#d6453d')
  box(b, f, -0.2, 0.2, y + 0.7, y + 0.8, -0.2, 0.2, '#b73a33')
  box(b, f, -0.3, 0.3, y + 0.4, y + 0.55, -0.07, 0.07, '#d6453d')
}

const utilityBox: Draw = (b, f, _p, y) => {
  box(b, f, -0.45, 0.45, y, y + 1.15, -0.28, 0.28, '#7d8791')
  box(b, f, -0.48, 0.48, y + 1.15, y + 1.25, -0.31, 0.31, '#5a636d')
}

const bollard: Draw = (b, f, _p, y) => {
  box(b, f, -0.13, 0.13, y, y + 0.9, -0.13, 0.13, PAL.metalDark)
  box(b, f, -0.14, 0.14, y + 0.7, y + 0.82, -0.14, 0.14, PAL.hazard)
}

const tireStack: Draw = (b, f, p, y) => {
  for (let i = 0; i < 3; i++) box(b, f, -0.45 + (i % 2) * 0.05, 0.45 + (i % 2) * 0.05, y + i * 0.42, y + i * 0.42 + 0.4, -0.45, 0.45, i === 1 ? '#25272c' : '#2f3238')
  if (p.variant % 2) box(b, f, -0.4, 0.4, y + 1.26, y + 1.3, -0.4, 0.4, '#ca3a2e')
}

const shelter: Draw = (b, f, _p, y) => {
  for (const [u, v] of [[-3, -1.8], [3, -1.8], [-3, 1.8], [3, 1.8]] as const) box(b, f, u - 0.12, u + 0.12, y, y + 3.2, v - 0.12, v + 0.12, PAL.frameWhite)
  box(b, f, -3.5, 3.5, y + 3.2, y + 3.4, -2.5, 2.5, PAL.roofGreen)
  box(b, f, -3.2, 3.2, y + 3.4, y + 3.55, -2.2, 2.2, '#6a9a76')
  box(b, f, -3, 3, y, y + 0.12, -1.8, 1.8, PAL.promenade)
}

/** Tiered stone base, tall obelisk with an accent band and a floating square ring: the Central Plaza landmark. */
const monument: Draw = (b, f, _p, y) => {
  box(b, f, -4.5, 4.5, y, y + 0.3, -4.5, 4.5, '#cbc5b6')
  box(b, f, -3.8, 3.8, y + 0.3, y + 0.6, -3.8, 3.8, '#bdb6a5')
  box(b, f, -3.1, 3.1, y + 0.6, y + 0.9, -3.1, 3.1, '#b0a995')
  box(b, f, -1.3, 1.3, y + 0.9, y + 2.4, -1.3, 1.3, '#8f8a7c')
  // Tapering obelisk (4 faces + cap).
  const y0 = y + 2.4
  const y1 = y + 12.6
  const r0 = 1.0
  const r1 = 0.55
  const corner = (r: number, i: number): [number, number] => [[-r, -r], [r, -r], [r, r], [-r, r]][i] as [number, number]
  for (let i = 0; i < 4; i++) {
    const a0 = corner(r0, i)
    const a1 = corner(r0, (i + 1) % 4)
    const t0 = corner(r1, i)
    const t1 = corner(r1, (i + 1) % 4)
    const mid = [(a0[0] + a1[0]) / 2, (a0[1] + a1[1]) / 2]
    b.quad(f.pt(a0[0], y0, a0[1]), f.pt(a1[0], y0, a1[1]), f.pt(t1[0], y1, t1[1]), f.pt(t0[0], y1, t0[1]), f.normal(mid[0], 0.12, mid[1]), '#e9e4d6')
    b.tri(f.pt(t0[0], y1, t0[1]), f.pt(t1[0], y1, t1[1]), f.pt(0, y1 + 1.6, 0), '#2fa6a0', f.normal(mid[0] * 0.5, 1, mid[1] * 0.5))
  }
  box(b, f, -0.9, 0.9, y + 9, y + 9.6, -0.9, 0.9, '#ef6f5e')
  // Floating ring around the shaft, tied back with four arms.
  const ring = 2.6
  const ry = y + 6.6
  box(b, f, -ring, ring, ry, ry + 0.25, -ring, -ring + 0.25, '#2fa6a0')
  box(b, f, -ring, ring, ry, ry + 0.25, ring - 0.25, ring, '#2fa6a0')
  box(b, f, -ring, -ring + 0.25, ry, ry + 0.25, -ring + 0.25, ring - 0.25, '#2fa6a0')
  box(b, f, ring - 0.25, ring, ry, ry + 0.25, -ring + 0.25, ring - 0.25, '#2fa6a0')
  for (const [u, v] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) box(b, f, Math.min(0, u * ring) - (u === 0 ? 0.08 : 0), Math.max(0, u * ring) + (u === 0 ? 0.08 : 0), ry + 0.08, ry + 0.16, Math.min(0, v * ring) - (v === 0 ? 0.08 : 0), Math.max(0, v * ring) + (v === 0 ? 0.08 : 0), '#2fa6a0')
}

const DRAWERS: Partial<Record<PropDef['kind'], Draw>> = {
  streetlight,
  bench,
  bin,
  planter,
  'stop-sign': stopSign,
  fence,
  container,
  hydrant,
  'utility-box': utilityBox,
  bollard,
  'tire-stack': tireStack,
  shelter,
  monument,
}

export function drawProp(b: GeometryBuilder, p: PropDef, baseY: number): void {
  DRAWERS[p.kind]?.(b, new Frame(p.x, p.z, p.facing), p, baseY)
}
