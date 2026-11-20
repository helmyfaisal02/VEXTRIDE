import { CylinderGeometry, MeshStandardMaterial } from 'three'
import { GeometryBuilder } from '../city/geometryBuilder'

export function modelParts() {
  return {body:new GeometryBuilder(),glass:new GeometryBuilder(),trim:new GeometryBuilder(),head:new GeometryBuilder(),tail:new GeometryBuilder(),spokes:new GeometryBuilder()}
}
export function modelBox(b: GeometryBuilder,x:number,y:number,z:number,w:number,h:number,l:number,color:string) {
  b.box({minX:x-w/2,maxX:x+w/2,minZ:z-l/2,maxZ:z+l/2},y-h/2,y+h/2,color,true)
}
export function belt(b: GeometryBuilder,sections: number[][],color:string) {
  for(let i=0;i<sections.length-1;i++){
    const[z0,w0,h0]=sections[i],[z1,w1,h1]=sections[i+1]
    b.quad([-w0,h0,z0],[w0,h0,z0],[w1,h1,z1],[-w1,h1,z1],[0,1,-(h1-h0)/(z1-z0)],color)
    for(const s of[-1,1])b.quad([s*w0,.09,z0],[s*w1,.09,z1],[s*w1,h1,z1],[s*w0,h0,z0],[s,0,-(w1-w0)/(z1-z0)],color)
  }
}
export function createSharedVehicleMaterials() {
  return {
    body:new MeshStandardMaterial({vertexColors:true,roughness:.36,metalness:.25}),
    glass:new MeshStandardMaterial({vertexColors:true,roughness:.2,metalness:.45}),
    trim:new MeshStandardMaterial({vertexColors:true,roughness:.65}),
    tire:new MeshStandardMaterial({color:'#20252b',roughness:.95}),
  }
}
export type SharedVehicleMaterials = ReturnType<typeof createSharedVehicleMaterials>
export function finishModel(parts:ReturnType<typeof modelParts>,radius:number,width:number) {
  modelBox(parts.spokes,0,0,0,width+.015,radius*1.12,.06,'#c5d3d8')
  modelBox(parts.spokes,0,0,0,width+.015,.06,radius*1.12,'#c5d3d8')
  return {
    geometries:{body:parts.body.build(),glass:parts.glass.build(),trim:parts.trim.build(),head:parts.head.build(),tail:parts.tail.build(),spokes:parts.spokes.build(),tire:new CylinderGeometry(radius,radius,width,16)},
    materials:{...createSharedVehicleMaterials(),head:new MeshStandardMaterial({vertexColors:true,emissive:'#fff0c4',emissiveIntensity:.2}),tail:new MeshStandardMaterial({vertexColors:true,emissive:'#ff263e',emissiveIntensity:.3})},
  }
}
