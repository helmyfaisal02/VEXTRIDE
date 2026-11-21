const { chromium } = await import(process.env.VEXTRIDE_PLAYWRIGHT_MODULE ?? 'playwright')
import fs from 'node:fs'
import assert from 'node:assert/strict'
const mode=process.argv[2]??'before', dev=process.env.VEXTRIDE_DEV_URL??'http://127.0.0.1:5175', prod=process.argv[3]??'http://127.0.0.1:4175'
const browser=await chromium.launch({executablePath:process.env.VEXTRIDE_CHROMIUM,headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--js-flags=--expose-gc']})
const out={mode,scenarios:[],errors:[]}
const evidence=process.env.VEXTRIDE_EVIDENCE_DIR??'/tmp/vex71'
fs.mkdirSync(evidence,{recursive:true})
const fixture=fs.readFileSync('docs/phase53/earned-save-fixture.json','utf8')
const historyKey='vextride.arc.transfers.v1', sender='0x1111111111111111111111111111111111111111', recipient='0x2222222222222222222222222222222222222222'
const transferHash='0x'+'ab'.repeat(32)
const setup=async(origin,size={width:1024,height:768})=>{
 const c=await browser.newContext({viewport:size})
 await c.addInitScript(({origin,fixture,historyKey,sender,recipient,transferHash})=>{
  if(location.origin!==origin)return
  if(!localStorage.getItem('vextride.guest.progress.v1'))localStorage.setItem('vextride.guest.progress.v1',fixture)
  if(!localStorage.getItem(historyKey))localStorage.setItem(historyKey,JSON.stringify({version:1,records:[{id:'11111111-1111-4111-8111-111111111111',chainId:5042,sender,recipient,amount:'1234567',status:'pending',hash:transferHash,createdAt:Date.now(),checkedAt:null,head:'16',block:null,logIndex:null}]}))
  const add=EventTarget.prototype.addEventListener,remove=EventTarget.prototype.removeEventListener,set=Storage.prototype.setItem
  window.probe={listeners:new Map(),writes:{},wallet:new Map(),calls:[]}
  EventTarget.prototype.addEventListener=function(type,fn,opts){
   if(this===window||this===document||this instanceof HTMLCanvasElement){
    const group=this===window?'window':this===document?'document':this
    let byType=window.probe.listeners.get(group)
    if(!byType){byType=new Map();window.probe.listeners.set(group,byType)}
    let callbacks=byType.get(type)
    if(!callbacks){callbacks=new Set();byType.set(type,callbacks)}
    callbacks.add(fn)
   }
   return add.call(this,type,fn,opts)
  }
  EventTarget.prototype.removeEventListener=function(type,fn,opts){
   const group=this===window?'window':this===document?'document':this
   window.probe.listeners.get(group)?.get(type)?.delete(fn)
   return remove.call(this,type,fn,opts)
  }
  Storage.prototype.setItem=function(key,value){window.probe.writes[key]=(window.probe.writes[key]??0)+1;return set.call(this,key,value)}
  window.ethereum={
   request({method}){window.probe.calls.push(method);if(method==='eth_chainId')return Promise.resolve('0x13b2');if(method==='eth_accounts'||method==='eth_requestAccounts')return Promise.resolve([sender]);return Promise.reject(Error('Unexpected input'))},
   on(type,fn){let set=window.probe.wallet.get(type);if(!set){set=new Set();window.probe.wallet.set(type,set)}set.add(fn)},
   removeListener(type,fn){window.probe.wallet.get(type)?.delete(fn)},
  }
 },{origin,fixture,historyKey,sender,recipient,transferHash})
 await c.route('https://rpc.mainnet.arc.io/**',async r=>{
   const q=r.request().postDataJSON()
   const result=q.method==='eth_chainId'?'0x13b2':q.method==='eth_call'?'0x'+(10000000).toString(16).padStart(64,'0'):null
   await r.fulfill({json:{jsonrpc:'2.0',id:q.id,result},headers:{'access-control-allow-origin':origin}})
 })
 const p=await c.newPage()
 p.on('pageerror',e=>out.errors.push(e.message))
 p.on('console',m=>{if(m.type()==='error'&&/WebGL|shader/i.test(m.text()))out.errors.push(m.text())})
 return {p,c}
}
const btn=(p,name)=>p.getByRole('button',{name,exact:true})
async function enter(p){
 await Promise.race([btn(p,'Start Playing').waitFor(),btn(p,'Arc Wallet').waitFor({timeout:50000})])
 const input=p.getByRole('textbox')
 if(await input.isVisible()){await input.fill('Performance71');await btn(p,'Start Playing').click()}
 await btn(p,'Arc Wallet').waitFor({timeout:50000})
}
async function runProduction(){
 const {p,c}=await setup(prod,{width:375,height:812})
 const requests=[]
 p.on('request',r=>requests.push(new URL(r.url()).pathname))
 const start=Date.now()
 await p.goto(prod)
 await btn(p,'Start Playing').waitFor({timeout:60000})
 const creatorMs=Date.now()-start
 await enter(p)
 const readyMs=Date.now()-start
 const startup=requests.filter(url=>/\.js$/.test(url))
 assert.ok(!startup.some(url=>url.includes('ArcWalletContent')))
 assert.deepEqual(await p.evaluate(()=>window.probe.calls),[])
 const opened=Date.now()
 await btn(p,'Arc Wallet').click()
 await btn(p,'Connect Wallet').click()
 await p.getByText('Connected to Arc Mainnet',{exact:true}).waitFor()
 await p.getByText('Pending',{exact:true}).waitFor()
 assert.ok(requests.some(url=>url.includes('ArcWalletContent')))
 const panel=p.getByRole('dialog')
 assert.ok(await panel.evaluate(e=>e.scrollWidth<=e.clientWidth+1&&e.getBoundingClientRect().right<=innerWidth))
 await p.screenshot({path:evidence+'/'+mode+'-mobile-wallet.png'})
 await btn(p,'Disconnect').click()
 await p.keyboard.press('Escape')
 await panel.waitFor({state:'hidden'})
 const walletListeners=await p.evaluate(()=>[...window.probe.wallet.values()].reduce((a,s)=>a+s.size,0))
 assert.equal(walletListeners,0)
 out.production={creatorMs,readyMs,walletMs:Date.now()-opened,initialJs:startup,walletRequest:requests.find(url=>url.includes('ArcWalletContent')),walletListeners}
 await p.reload()
 await enter(p)
 assert.deepEqual(await p.evaluate(()=>window.probe.calls),[])
 assert.equal(await p.getByTestId('street-cash').textContent(),'STREET CASH: 325 SC')
 const saved=await p.evaluate(()=>JSON.parse(localStorage.getItem('vextride.guest.progress.v1')))
 assert.deepEqual(saved.economy,JSON.parse(fixture).economy)
 await c.close()
}
async function failureCase(){
 const {p,c}=await setup(prod)
 const errorsBefore=out.errors.length
 await p.route('**/ArcWalletContent-*.js',r=>r.abort())
 await p.goto(prod)
 await enter(p)
 await btn(p,'Arc Wallet').click()
 const worldFailed=p.getByText('The 3D engine could not start.',{exact:false})
 const walletFailed=p.getByText('Wallet panel could not load.',{exact:false})
 await Promise.race([worldFailed.waitFor(),walletFailed.waitFor()])
 out.walletChunkFailure={worldFailed:await worldFailed.isVisible(),isolated:await walletFailed.isVisible(),expectedFailureErrors:out.errors.splice(errorsBefore)}
 if(out.walletChunkFailure.isolated){await p.keyboard.press('Escape');assert.ok(await btn(p,'Arc Wallet').isVisible())}
 await c.close()
}
async function runDev(){
 const {p,c}=await setup(dev)
 const response=await fetch(dev+'/src/main.tsx')
 let source=await response.text()
 const match='createRoot(document.getElementById("root")).render('
 assert.ok(source.includes(match))
 source=source.replace(match,'const testRender = () => (window.testRoot = createRoot(document.getElementById("root"))).render(')
 source+='\nwindow.testRemount = testRender; testRender();\n'
 await p.route(/\/src\/main\.tsx(?:\?.*)?$/,route=>route.fulfill({contentType:'text/javascript',body:source}))
 await p.goto(dev,{waitUntil:'domcontentloaded',timeout:45000})
 await p.waitForFunction(()=>typeof window.testRoot?.unmount==='function')
 await enter(p)
 await p.evaluate(async()=>{
  window.getModule=path=>{
   const match=performance.getEntriesByType('resource').filter(e=>new URL(e.name).pathname===path).at(-1)?.name
   return import(match??path)
  }
  const fiberUrl=performance.getEntriesByType('resource').find(r=>r.name.includes('/@react-three_fiber.js'))?.name
  if(!fiberUrl)throw Error('No R3F module')
  window.fiber=await import(fiberUrl)
  window.vehicle=await window.getModule('/src/game/vehicles/vehicleState.ts')
  window.motion=await window.getModule('/src/game/state/gameStore.ts')
  window.clock=(await window.getModule('/src/game/world/worldTime.ts')).worldClock
  window.rig=(await window.getModule('/src/game/camera/cameraRig.ts')).cameraRig
  window.place=(x,y,z)=>{const body=window.vehicle.vehicleRuntime.pedestrian;body.setTranslation({x,y,z},true);body.setLinvel({x:0,y:0,z:0},true)}
  window.resources=()=>{
   const canvas=document.querySelector('canvas'), r3f=canvas?window.fiber._roots.get(canvas):null
   const root=r3f?.store.getState()
   function physicsCallbacks(node){
    if(!node)return null
    const value=node.memoizedProps?.value
    if(value?.beforeStepCallbacks instanceof Set && value?.afterStepCallbacks instanceof Set)
     return [value.beforeStepCallbacks.size,value.afterStepCallbacks.size]
    return physicsCallbacks(node.child)??physicsCallbacks(node.sibling)
   }
   const sizes={geometries:new Set(),materials:new Set()}
   root?.scene.traverse(o=>{if(o.geometry)sizes.geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[])sizes.materials.add(m)})
   const b=window.vehicle.vehicleRuntime.pedestrian
   const count=(group)=>[...(window.probe.listeners.get(group)?.values()??[])].reduce((n,set)=>n+set.size,0)
   return {render:root?{calls:root.gl.info.render.calls,triangles:root.gl.info.render.triangles,...root.gl.info.memory}:null,
    scene:[sizes.geometries.size,sizes.materials.size],physicsCallbacks:physicsCallbacks(r3f?.fiber.current),frames:root?.internal.subscribers.length??0,
    bodies:b?.isValid()?b.rawSet.len():0,colliders:b?.isValid()?b.colliderSet.len():0,
    listeners:[count('window'),count('document')],contextLost:canvas?(window.probe.listeners.get(canvas)?.get('webglcontextlost')?.size??0):0,
    roots:window.fiber._roots.size,writes:{...window.probe.writes},heap:performance.memory?.usedJSHeapSize??null}
  }
 })
 await p.waitForFunction(()=>window.resources().bodies===47&&window.resources().render?.calls>0)
 const metric=async(name)=>out.scenarios.push({name,...await p.evaluate(()=>window.resources())})
 await p.evaluate(()=>window.gc?.())
 await metric('initial')
 const cpu=await c.newCDPSession(p)
 await cpu.send('Performance.enable')
 const task=async()=> (await cpu.send('Performance.getMetrics')).metrics.find(x=>x.name==='TaskDuration').value
 const t0=await task()
 await p.waitForTimeout(3000)
 out.idleTaskMs=(await task()-t0)*1000
 await p.keyboard.down('w');await p.keyboard.down('Shift');await p.waitForTimeout(1400);await p.keyboard.up('Shift');await p.keyboard.up('w')
 await metric('walk-sprint')
 await p.keyboard.press('c');await p.waitForTimeout(300);await p.keyboard.press('c')
 await p.keyboard.press('f');await p.waitForTimeout(600);await p.keyboard.press('f')
 await p.keyboard.press('p');await p.waitForTimeout(400);await p.keyboard.press('p')
 await p.keyboard.press('Shift+t')
 await p.getByRole('combobox',{name:'World hour'}).selectOption('1')
 await p.waitForTimeout(700)
 await metric('night')
 await p.getByRole('combobox',{name:'World hour'}).selectOption('12')
 await btn(p,'Close time controls').click()
 await p.evaluate(async()=>{
  const configs=await window.getModule('/src/game/npcs/npcConfig.ts')
  const d=configs.NPCS.find(x=>x.id==='maya')
  window.place(d.spawn.x-2,d.spawn.y+.94,d.spawn.z)
 })
 await p.waitForTimeout(500);await p.keyboard.press('e');await p.getByTestId('npc-dialogue').waitFor()
 await metric('maya-dialogue')
 await p.keyboard.press('Escape')
 await p.evaluate(async()=>{
  const {GARAGE}=await window.getModule('/src/game/garage/garageConfig.ts')
  window.place(GARAGE.terminal.x,GARAGE.terminal.y+.94,GARAGE.terminal.z+1.5)
 })
 await p.waitForTimeout(500);await p.keyboard.press('e');await p.getByTestId('garage-panel').waitFor()
 if(process.argv.includes('--extended')){
  const beforeBalance=await p.getByTestId('street-cash').textContent()
  assert.equal(beforeBalance,'STREET CASH: 325 SC')
  await p.getByLabel('New body color').selectOption('violet')
  await btn(p,'Review respray').click()
  await btn(p,'Confirm respray — 125 SC').click()
  await p.getByText('STREET CASH: 200 SC',{exact:true}).waitFor()
 }
 await metric('garage')
 await p.keyboard.press('Escape')
 await p.evaluate(()=>{
  const car=window.vehicle.getVehicleRuntime('street-coupe').body
  const v=car.translation()
  window.place(v.x-1.8,v.y+.42,v.z)
 })
 await p.waitForTimeout(450);await p.keyboard.press('e')
 await p.waitForFunction(()=>window.vehicle.useVehicleStore.getState().driving)
 await p.keyboard.down('s');await p.waitForTimeout(1800);await p.keyboard.up('s')
 await p.keyboard.down('Space');await p.waitForTimeout(900);await p.keyboard.up('Space')
 await metric('driving')
 await p.keyboard.press('e')
 await p.waitForFunction(()=>!window.vehicle.useVehicleStore.getState().driving)
 await p.waitForTimeout(9500)
 await p.evaluate(()=>window.gc?.())
 await metric('extended-world')
 for(let i=0;i<2;i++){
  const old=await p.evaluateHandle(()=>document.querySelector('canvas'))
  const owned=await p.evaluateHandle(()=>{
   const state=window.fiber._roots.get(document.querySelector('canvas')).store.getState()
   const trees=state.scene.getObjectByName('city-trees')
   const resources=[...new Set(trees.children.flatMap(m=>[m.geometry,m.material]))]
   const tracker={geometry:0,material:0}
   for(const owned of resources)owned.addEventListener('dispose',()=>tracker[owned.isBufferGeometry?'geometry':'material']++)
   return tracker
  })
  await p.evaluate(()=>window.testRoot.unmount())
  await p.waitForFunction(()=>window.fiber._roots.size===0)
  const lost=await old.evaluate(canvas=>window.probe.listeners.get(canvas)?.get('webglcontextlost')?.size??0)
  const disposal=await owned.jsonValue()
  await metric('unmount-'+i)
  out.scenarios.at(-1).treeDisposals=disposal
  out.scenarios.at(-1).retainedContextLostListeners=lost
  await old.dispose();await owned.dispose()
  await p.evaluate(()=>window.testRemount())
  await enter(p)
  await p.waitForFunction(()=>window.resources().bodies===47&&window.resources().render?.calls>0)
  await p.evaluate(()=>window.gc?.())
  await metric('remount-'+i)
 }
 if(process.argv.includes('--extended')){
  await p.getByRole('button',{name:/Edit character/}).click()
  const presets=p.getByRole('radiogroup',{name:'Character preset'}).getByRole('radio')
  assert.equal(await presets.count(),3)
  for(let i=0;i<3;i++)await presets.nth(i).click()
  await btn(p,'Save Character').click()
  // Exercise live movement and scene systems for an additional minute.
  await p.evaluate(()=>{window.place(0,.94,-12);window.rig.yaw=0})
  const started=Date.now()
  for(let cycle=0;cycle<10;cycle++){
   for(const key of ['w','s','a','d']){
    await p.keyboard.down(key)
    await p.waitForTimeout(1350)
    await p.keyboard.up(key)
   }
   if(cycle%2===0){await p.keyboard.press('c');await p.waitForTimeout(200);await p.keyboard.press('c')}
  }
  out.extendedActionMs=Date.now()-started
  await p.evaluate(()=>window.gc?.())
  await metric('extended-active')
  assert.equal(out.scenarios.at(-1).bodies,47)
  assert.equal(out.scenarios.at(-1).colliders,565)
  const contextLoss=await p.evaluate(()=>{
   const canvas=document.querySelector('canvas')
   const gl=window.fiber._roots.get(canvas).store.getState().gl
   const extension=gl.getContext().getExtension('WEBGL_lose_context')
   if(!extension)return false
   window.webglRecovery={prevented:false,restored:false}
   canvas.addEventListener('webglcontextlost',e=>{window.webglRecovery.prevented=e.defaultPrevented;setTimeout(()=>extension.restoreContext(),750)},{once:true})
   canvas.addEventListener('webglcontextrestored',()=>{window.webglRecovery.restored=true},{once:true})
   extension.loseContext()
   return true
  })
  if(contextLoss){
   await p.waitForFunction(()=>window.webglRecovery.restored)
   assert.ok(await p.evaluate(()=>window.webglRecovery.prevented))
   await p.waitForTimeout(1300)
   await p.waitForFunction(()=>window.resources().render.calls>0)
   await metric('restored-webgl')
  }
  out.webglContextRecovery=contextLoss
 }
 await p.screenshot({path:evidence+'/'+mode+'-world.png'})
 await c.close()
}
try {
 if(!process.argv.includes('--dev-only')){
  await runProduction()
  console.log('production ok')
  if(!process.argv.includes('--load-only')){
   await failureCase()
   console.log('failure ok')
  }
 }
 if(!process.argv.includes('--load-only')){
  await runDev()
  console.log('dev ok')
 }
}
catch(error){out.failure=String(error);console.error(error);process.exitCode=1}
finally{fs.writeFileSync(evidence+'/'+mode+'-browser.json',JSON.stringify(out,null,2));await browser.close()}
