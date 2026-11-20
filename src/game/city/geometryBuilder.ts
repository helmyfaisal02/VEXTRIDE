import { BufferGeometry, Color, Float32BufferAttribute } from 'three'
import type { Rect } from './cityTypes'

type V3 = readonly [number, number, number]

/**
 * Accumulates flat-shaded quads into one BufferGeometry so a whole class of
 * city surface (all asphalt, all sidewalks...) becomes a single draw call.
 * Each quad is written with its own vertices and an exact normal. Winding is
 * corrected automatically to match the requested normal.
 */
export class GeometryBuilder {
  private positions: number[] = []
  private normals: number[] = []
  private colors: number[] = []
  private indices: number[] = []
  private scratch = new Color()

  get triangleCount(): number {
    return this.indices.length / 3
  }

  /** One flat quad with an explicit normal (winding is corrected to match it). */
  quad(p0: V3, p1: V3, p2: V3, p3: V3, normal: V3, color: string): void {
    const ux = p1[0] - p0[0]
    const uy = p1[1] - p0[1]
    const uz = p1[2] - p0[2]
    const vx = p2[0] - p0[0]
    const vy = p2[1] - p0[1]
    const vz = p2[2] - p0[2]
    const cx = uy * vz - uz * vy
    const cy = uz * vx - ux * vz
    const cz = ux * vy - uy * vx
    // Keep counter-clockwise order as seen from the side the normal points to.
    const nl = Math.hypot(normal[0], normal[1], normal[2]) || 1
    const unit: V3 = [normal[0] / nl, normal[1] / nl, normal[2] / nl]
    const flip = cx * unit[0] + cy * unit[1] + cz * unit[2] < 0
    const order = flip ? [p0, p3, p2, p1] : [p0, p1, p2, p3]
    this.scratch.set(color)
    const base = this.positions.length / 3
    for (const p of order) {
      this.positions.push(p[0], p[1], p[2])
      this.normals.push(unit[0], unit[1], unit[2])
      this.colors.push(this.scratch.r, this.scratch.g, this.scratch.b)
    }
    this.indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
  }

  /** One triangle. Without `facing` the vertex order sets the front side; with it, the order is fixed to match. */
  tri(p0: V3, p1: V3, p2: V3, color: string, facing?: V3): void {
    const ux = p1[0] - p0[0]
    const uy = p1[1] - p0[1]
    const uz = p1[2] - p0[2]
    const vx = p2[0] - p0[0]
    const vy = p2[1] - p0[1]
    const vz = p2[2] - p0[2]
    const nx = uy * vz - uz * vy
    const ny = uz * vx - ux * vz
    const nz = ux * vy - uy * vx
    const len = Math.hypot(nx, ny, nz)
    if (len < 1e-9) return
    const flip = facing ? nx * facing[0] + ny * facing[1] + nz * facing[2] < 0 : false
    const sign = flip ? -1 : 1
    this.scratch.set(color)
    const base = this.positions.length / 3
    for (const p of flip ? [p0, p2, p1] : [p0, p1, p2]) {
      this.positions.push(p[0], p[1], p[2])
      this.normals.push((sign * nx) / len, (sign * ny) / len, (sign * nz) / len)
      this.colors.push(this.scratch.r, this.scratch.g, this.scratch.b)
    }
    this.indices.push(base, base + 1, base + 2)
  }

  /** A closed box (top and four sides; the bottom only when asked for). */
  box(r: Rect, y0: number, y1: number, color: string, bottom = false): void {
    this.top(r, y1, color)
    this.sides(r, y0, y1, color)
    if (bottom) this.quad([r.minX, y0, r.minZ], [r.maxX, y0, r.minZ], [r.maxX, y0, r.maxZ], [r.minX, y0, r.maxZ], [0, -1, 0], color)
  }

  /** Horizontal quad facing up at height `y`. */
  top(r: Rect, y: number, color: string): void {
    this.quad([r.minX, y, r.minZ], [r.minX, y, r.maxZ], [r.maxX, y, r.maxZ], [r.maxX, y, r.minZ], [0, 1, 0], color)
  }

  /** Four vertical faces of a box between heights `y0` and `y1`. `inward` faces look into the rect (for a lot's rim). */
  sides(r: Rect, y0: number, y1: number, color: string, inward = false): void {
    const s = inward ? -1 : 1
    this.quad([r.minX, y0, r.minZ], [r.maxX, y0, r.minZ], [r.maxX, y1, r.minZ], [r.minX, y1, r.minZ], [0, 0, -s], color)
    this.quad([r.minX, y0, r.maxZ], [r.maxX, y0, r.maxZ], [r.maxX, y1, r.maxZ], [r.minX, y1, r.maxZ], [0, 0, s], color)
    this.quad([r.minX, y0, r.minZ], [r.minX, y0, r.maxZ], [r.minX, y1, r.maxZ], [r.minX, y1, r.minZ], [-s, 0, 0], color)
    this.quad([r.maxX, y0, r.minZ], [r.maxX, y0, r.maxZ], [r.maxX, y1, r.maxZ], [r.maxX, y1, r.minZ], [s, 0, 0], color)
  }

  build(): BufferGeometry {
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(this.positions, 3))
    g.setAttribute('normal', new Float32BufferAttribute(this.normals, 3))
    g.setAttribute('color', new Float32BufferAttribute(this.colors, 3))
    g.setIndex(this.indices)
    g.computeBoundingSphere()
    g.computeBoundingBox()
    return g
  }
}

/** A rectangle given by its centre and size. */
export function rectAround(cx: number, cz: number, sizeX: number, sizeZ: number): Rect {
  return { minX: cx - sizeX / 2, maxX: cx + sizeX / 2, minZ: cz - sizeZ / 2, maxZ: cz + sizeZ / 2 }
}
