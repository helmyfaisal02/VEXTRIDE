const { chromium } = await import(process.env.VEXTRIDE_PLAYWRIGHT_MODULE ?? 'playwright')
import fs from 'node:fs'
const label=process.argv[2]||'capture'
const evidence=process.env.VEXTRIDE_EVIDENCE_DIR??'/tmp/vex-road'
fs.mkdirSync(evidence,{recursive:true})
const browser=await chromium.launch({executablePath:process.env.VEXTRIDE_CHROMIUM,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']})
const page=await browser.newPage({viewport:{width:1280,height:800}})
const errors=[]
page.on('pageerror',e=>errors.push(e.message))
page.on('console',m=>{if(m.type()==='error'&&/shader|WebGL/i.test(m.text()))errors.push(m.text())})
await page.goto(process.env.VEXTRIDE_DEV_URL??'http://127.0.0.1:5178')
await page.getByRole('textbox').fill('Road Test')
await page.getByRole('button',{name:'Start Playing',exact:true}).click()
await page.getByRole('button',{name:'Arc Wallet',exact:true}).waitFor({timeout:60000})
await page.evaluate(async()=>{
 window.moduleAt=path=>import(performance.getEntriesByType('resource').filter(r=>new URL(r.name).pathname===path).at(-1)?.name??path)
 window.fiber=await import(performance.getEntriesByType('resource').find(r=>r.name.includes('/@react-three_fiber.js')).name)
 window.live=()=>window.fiber._roots.get(document.querySelector('canvas')).store.getState()
 window.vehicles=await window.moduleAt('/src/game/vehicles/vehicleState.ts')
 window.rig=(await window.moduleAt('/src/game/camera/cameraRig.ts')).cameraRig
 window.clock=(await window.moduleAt('/src/game/world/worldTime.ts')).worldClock
 window.surface=(await window.moduleAt('/src/game/city/citySurface.ts')).surfaceHeightAt
 window.clock.setPaused(true)
 window.registry=()=>{
  const scene=window.live().scene
  const find=predicate=>{let found;scene.traverse(o=>{if(predicate(o))found=o});return found}
  return {
   ground:find(o=>o.isMesh&&o.geometry.type==='PlaneGeometry'&&o.geometry.parameters.width===1600&&o.material.isMeshStandardMaterial),
   grid:find(o=>o.isMesh&&o.material.uniforms?.infiniteGrid),
   road:scene.getObjectByName('city-roads').children[0],
   markings:scene.getObjectByName('city-roads').children[1],
   base:scene.getObjectByName('env-paint-base'),lines:scene.getObjectByName('env-paint-lines'),
  }
 }
})
await page.waitForTimeout(800)
const reports=[]
async function pose(name,x,z,yaw,pitch,distance,hour){
 await page.evaluate(({x,z,yaw,pitch,distance,hour})=>{
  const body=window.vehicles.vehicleRuntime.pedestrian
  body.setTranslation({x,y:window.surface(x,z)+.96,z},true)
  body.setLinvel({x:0,y:0,z:0},true)
  Object.assign(window.rig,{yaw,pitch,distance})
  window.clock.setHour(hour)
 },{x,z,yaw,pitch,distance,hour})
 await page.waitForTimeout(1100)
 await shot(name)
}
async function shot(name){
 const s=await page.evaluate(()=>{
  const {scene,gl,camera}=window.live(), r=window.registry()
  return {camera:camera.position.toArray(),depth:gl.getContext().getParameter(gl.getContext().DEPTH_BITS),calls:gl.info.render.calls,triangles:gl.info.render.triangles,geometries:gl.info.memory.geometries,roadTriangles:r.road.geometry.index.count/3,markingTriangles:r.markings.geometry.index.count/3,gridExpanded:r.grid.material.uniforms.infiniteGrid.value,bodies:window.vehicles.vehicleRuntime.pedestrian.rawSet.len(),colliders:window.vehicles.vehicleRuntime.pedestrian.colliderSet.len(),frames:window.live().internal.subscribers.length,grid:!!r.grid,ground:!!r.ground,lights:scene.children.filter(o=>o.isLight).length}
 })
 reports.push({name,...s})
 await page.screenshot({path:evidence+'/'+label+'-'+name+'.png'})
}
const diagnostics=[]
async function compareGrid(name,roi){
 const diagnostic=await page.evaluate(({name,roi})=>{
  const {gl,scene,camera}=window.live(), grid=window.registry().grid
  const context=gl.getContext(), w=context.drawingBufferWidth, h=context.drawingBufferHeight
  const uniform=grid.material.uniforms.infiniteGrid
  const original=uniform.value
  function pixels(visible,expanded){
   grid.visible=visible;uniform.value=expanded
   gl.render(scene,camera)
   const bytes=new Uint8Array(w*h*4)
   context.readPixels(0,0,w,h,context.RGBA,context.UNSIGNED_BYTE,bytes)
   return bytes
  }
  const current=pixels(true,original),hidden=pixels(false,original),expanded=pixels(true,true)
  grid.visible=true;uniform.value=original
  gl.render(scene,camera)
  const [left,top,right,bottom]=roi
  const diff=(a,b)=>{
   let value=0
   for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){
    const i=((h-1-y)*w+x)*4
    if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2])value++
   }
   return value
  }
  return {name,roi,depth:context.getParameter(context.DEPTH_BITS),currentAgainstHidden:diff(current,hidden),expandedAgainstHidden:diff(expanded,hidden)}
 },{name,roi})
 diagnostics.push(diagnostic)
}
await pose('long-night',1,-120,Math.PI,.37,14,2.45)
await compareGrid('main road at 02:27',[470,375,805,735])
await pose('long-day',1,-120,Math.PI,.37,14,12)
await compareGrid('same main road in daylight',[470,375,805,735])
await pose('bakery-long',-40,-81,-1.03,.27,14,2.45)
await compareGrid('night street by retail façades',[360,435,910,710])
await pose('storefront-close-night',-39,-74,0,.24,7,2.45)
await pose('storefront-close-day',-39,-74,0,.24,7,12)
await pose('plaza-night',-14,-17,.35,.32,9,2.45)
await pose('intersection-day',-9,-76,.28,.44,11,12)
await pose('residential-day',-83,-118,Math.PI/2,.27,6,12)
await pose('residential-night',-83,-118,Math.PI/2,.36,10,2.45)
const cuts=await page.evaluate(async()=>(await window.moduleAt('/src/game/city/driveways.ts')).DRIVEWAYS.map(d=>({id:d.id,crossing:d.crossing})))
for(const cut of cuts){
 const {minX,maxX,minZ,maxZ}=cut.crossing
 const north=cut.id==='north-parking'
 const x=(minX+maxX)/2
 const z=north?minZ-5:maxZ+5
 await pose(cut.id+'-day',x,z,north?Math.PI:0,.32,7,12)
 await pose(cut.id+'-night',x,z,north?Math.PI-.24:.24,.27,10,2.45)
}
await pose('garage-parking',120,-139,0,.47,12,12)
await pose('outside-demo-yard',258,-20,.2,.37,8,12)
await compareGrid('terrain outside the city',[470,460,805,735])
fs.writeFileSync(evidence+'/'+label+'.json',JSON.stringify({reports,diagnostics,errors},null,2))
await page.evaluate(()=>{
 const runtime=window.vehicles.getVehicleRuntime('street-coupe')
 const car=runtime.body
 car.setTranslation({x:3,y:runtime.definition.rideHeight+window.surface(3,-110),z:-110},true)
 car.setRotation({x:0,y:1,z:0,w:0},true)
 car.setLinvel({x:0,y:0,z:0},true)
 const player=window.vehicles.vehicleRuntime.pedestrian
 player.setTranslation({x:5,y:window.surface(5,-110)+.96,z:-110},true)
 player.setLinvel({x:0,y:0,z:0},true)
 window.clock.setHour(2.45)
})
await page.waitForTimeout(700)
await page.keyboard.press('e')
await page.waitForFunction(()=>window.vehicles.useVehicleStore.getState().driving)
await page.keyboard.down('w')
await page.waitForTimeout(2500)
await shot('moving-coupe-night')
await page.keyboard.up('w')
await page.keyboard.down('Space')
await page.waitForFunction(()=>{
 const car=window.vehicles.getVehicleRuntime('street-coupe').body
 const speed=car.linvel()
 return Math.hypot(speed.x,speed.z)<.3
})
await page.keyboard.press('e')
await page.keyboard.up('Space')
await page.waitForFunction(()=>!window.vehicles.useVehicleStore.getState().driving)
await page.keyboard.down('w')
await page.waitForTimeout(800)
await shot('walking-downtown-after-exit')
await page.keyboard.up('w')
fs.writeFileSync(evidence+'/'+label+'.json',JSON.stringify({reports,diagnostics,errors},null,2))
await browser.close()
