import { CylinderGeometry, MeshStandardMaterial } from 'three'
import { GeometryBuilder } from '../city/geometryBuilder'

/** Original compact coupe: shaped belt, hood/trunk, open wheel wells and raked glazing. */
export function createCoupeAssets() {
  const body = new GeometryBuilder(), glass = new GeometryBuilder(), trim = new GeometryBuilder()
  const head = new GeometryBuilder(), tail = new GeometryBuilder(), spokes = new GeometryBuilder()
  const box = (b: GeometryBuilder, x: number, y: number, z: number, w: number, h: number, l: number, color: string) => b.box({ minX: x - w / 2, maxX: x + w / 2, minZ: z - l / 2, maxZ: z + l / 2 }, y - h / 2, y + h / 2, color, true)
  const paint = '#319ca7', black = '#17232c', window = '#739aac'
  // Narrow nose and tail, broader fenders, hood crease and shaped shoulder line.
  const sections = [[-2.1, .67, .12], [-1.72, .86, .22], [-.88, .87, .25], [.85, .88, .25], [1.65, .86, .20], [2.1, .69, .12]]
  for (let i = 0; i < sections.length - 1; i++) {
    const [z0, w0, h0] = sections[i], [z1, w1, h1] = sections[i + 1]
    body.quad([-w0, h0, z0], [w0, h0, z0], [w1, h1, z1], [-w1, h1, z1], [0, 1, -(h1 - h0) / (z1 - z0)], paint)
    for (const sign of [-1, 1]) body.quad([sign * w0, .09, z0], [sign * w1, .09, z1], [sign * w1, h1, z1], [sign * w0, h0, z0], [sign, 0, -(w1 - w0) / (z1 - z0)], paint)
  }
  box(body, 0, -.085, 0, 1.68, .47, 1.65, paint) // doors/rockers between the visible wheel wells
  box(body, 0, -.12, -1.94, 1.43, .40, .32, paint)
  box(body, 0, -.12, 1.94, 1.43, .40, .32, paint)
  box(body, 0, .87, .10, 1.28, .06, 1.05, paint) // roof, total height = 1.40 m
  // Sloped front/rear glass, and two side panes separated by a B pillar.
  glass.quad([-.72,.25,-.98],[.72,.25,-.98],[.64,.84,-.425],[-.64,.84,-.425],[0,.7,-.7],window)
  glass.quad([.72,.25,1.06],[-.72,.25,1.06],[-.64,.84,.625],[.64,.84,.625],[0,.7,.7],window)
  for (const side of [-1, 1]) {
    glass.quad([side*.74,.25,-.90],[side*.74,.25,.05],[side*.64,.84,.05],[side*.64,.84,-.40],[side,0,0],window)
    glass.quad([side*.74,.25,.13],[side*.74,.25,1.0],[side*.64,.84,.60],[side*.64,.84,.13],[side,0,0],window)
    box(trim, side*.705, .54, .09, .11, .65, .065, black)
    box(trim, side*.85, -.14, 0, .055, .06, 1.65, black)
    box(trim, side*.855, .20, .43, .04, .045, .25, '#d4e0df') // door handle
    box(trim, side*.86, .36, -.58, .08, .10, .20, black) // compact mirror
    box(head, side*.49, .055, -2.105, .36, .13, .02, '#fff1c4')
    box(tail, side*.49, .07, 2.105, .38, .10, .02, '#ff3549')
  }
  box(trim, 0, -.07, -2.095, .55, .11, .015, black)
  box(trim, 0, -.15, 2.07, 1.25, .07, .04, black)
  box(trim, 0, .008, 2.102, .30, .09, .012, '#d9e0df') // fictional unbranded plate
  box(spokes, 0, 0, 0, .235, .36, .055, '#c5d3d8')
  box(spokes, 0, 0, 0, .235, .055, .36, '#c5d3d8')
  const geometries = { body: body.build(), glass: glass.build(), trim: trim.build(), head: head.build(), tail: tail.build(), spokes: spokes.build(), tire: new CylinderGeometry(.32,.32,.22,16) }
  const materials = {
    body: new MeshStandardMaterial({ vertexColors: true, roughness: .36, metalness: .25 }),
    glass: new MeshStandardMaterial({ vertexColors: true, roughness: .2, metalness: .45 }),
    trim: new MeshStandardMaterial({ vertexColors: true, roughness: .65 }),
    tire: new MeshStandardMaterial({ color: '#20252b', roughness: .95 }),
    head: new MeshStandardMaterial({ vertexColors: true, emissive: '#fff0c4', emissiveIntensity: .2 }),
    tail: new MeshStandardMaterial({ vertexColors: true, emissive: '#ff263e', emissiveIntensity: .3 }),
  }
  return { geometries, materials }
}
