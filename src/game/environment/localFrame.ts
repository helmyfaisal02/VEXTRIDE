import type { Rect } from '../city/cityTypes'
import type { Facing } from './envTypes'

/**
 * A building's local coordinate frame. `u` runs along the facade (to the right
 * as seen from the street), `v` runs from the building's centre toward its
 * front, `y` is up. Models are written once in this frame; the frame turns
 * them to face N, E, S or W with a pure 90 degree rotation (never a mirror).
 */
export class Frame {
  readonly cx: number
  readonly cz: number
  readonly facing: Facing

  constructor(cx: number, cz: number, facing: Facing) {
    this.cx = cx
    this.cz = cz
    this.facing = facing
  }

  /** World X and Z offsets of a local (u, v) displacement. */
  dir(u: number, v: number): [number, number] {
    switch (this.facing) {
      case 'S':
        return [u, v]
      case 'N':
        return [-u, -v]
      case 'E':
        return [v, -u]
      default:
        return [-v, u]
    }
  }

  pt(u: number, y: number, v: number): [number, number, number] {
    const [dx, dz] = this.dir(u, v)
    return [this.cx + dx, y, this.cz + dz]
  }

  /** World direction (unit) for a local normal given as (u, y, v). */
  normal(u: number, y: number, v: number): [number, number, number] {
    const [dx, dz] = this.dir(u, v)
    return [dx, y, dz]
  }

  rect(u0: number, u1: number, v0: number, v1: number): Rect {
    const [ax, az] = this.dir(u0, v0)
    const [bx, bz] = this.dir(u1, v1)
    return {
      minX: this.cx + Math.min(ax, bx),
      maxX: this.cx + Math.max(ax, bx),
      minZ: this.cz + Math.min(az, bz),
      maxZ: this.cz + Math.max(az, bz),
    }
  }
}

/** Footprint rectangle of something `width` wide (along the facade) and `depth` deep. */
export function footprint(cx: number, cz: number, width: number, depth: number, facing: Facing): Rect {
  const alongX = facing === 'N' || facing === 'S'
  const sx = alongX ? width : depth
  const sz = alongX ? depth : width
  return { minX: cx - sx / 2, maxX: cx + sx / 2, minZ: cz - sz / 2, maxZ: cz + sz / 2 }
}

/** World rectangle covering the strip in front of a building's door, `reach` metres deep. */
export function doorstep(cx: number, cz: number, width: number, depth: number, facing: Facing, reach: number, span: number): Rect {
  const f = new Frame(cx, cz, facing)
  return f.rect(-span / 2, span / 2, depth / 2, depth / 2 + reach)
}
