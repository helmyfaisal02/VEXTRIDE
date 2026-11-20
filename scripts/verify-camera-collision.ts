import RAPIER from '@dimforge/rapier3d-compat'
import { Vector3 } from 'three'
import { CAMERA_PROBE_RADIUS, cameraClearance, stepCameraDistance } from '../src/game/camera/cameraCollision'
import { ENVIRONMENT } from '../src/game/environment/envLayout'

await RAPIER.init()
let fails = 0
const check = (name: string, pass: boolean, detail = '') => { console.log(`${pass ? 'PASS' : 'FAIL'}  ${name} ${detail}`); if (!pass) fails++ }
const world = new RAPIER.World({ x: 0, y: 0, z: 0 })
const physics = { world, rapier: RAPIER }
const probe = new RAPIER.Ball(CAMERA_PROBE_RADIUS)
const origin = new Vector3(0, 1.6, 0), forward = new Vector3(0, 0, 1)
const wall = world.createCollider(RAPIER.ColliderDesc.cuboid(10, 3, 0.1).setTranslation(0, 2, 4))
world.step()
const allowed = cameraClearance(physics, origin, forward, 6.5, probe)
check('real Rapier wall sweep gives the same 30 cm centre clearance as the old flat-wall ray (within 1 mm solver tolerance)', Math.abs(allowed - 3.6) < 0.001, `${allowed.toFixed(4)} m`)
check('camera cannot ease beyond the safe wall distance on the first obstructed frame', stepCameraDistance(6.5, allowed, 1 / 60) <= allowed)
wall.setTranslation({ x: 0, y: 2, z: 0.6 }); world.step()
const tight = cameraClearance(physics, origin, forward, 6.5, probe)
check('tight spaces respect collision even below the former 0.9 m minimum', tight >= 0 && tight < 0.3)
wall.setTranslation({ x: 0, y: 2, z: 4 }); world.step()
const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 1.6, 1))
world.createCollider(RAPIER.ColliderDesc.ball(0.4), body)
world.createCollider(RAPIER.ColliderDesc.ball(0.4).setTranslation(0, 1.6, 2).setSensor(true))
world.step()
check('dynamic player/crate bodies and sensors never pull in the camera', Math.abs(cameraClearance(physics, origin, forward, 6.5, probe) - allowed) < 0.0001)
world.removeCollider(wall, false)
const corner = world.createCollider(RAPIER.ColliderDesc.cuboid(0.2, 3, 1).setTranslation(0.4, 2, 3))
world.step()
check('camera volume catches grazing walls a centre ray misses', world.castRay(new RAPIER.Ray(origin, forward), 6.5, true, RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC | RAPIER.QueryFilterFlags.EXCLUDE_SENSORS) === null && cameraClearance(physics, origin, forward, 6.5, probe) < 4)
corner.setTranslation({ x: 0.8, y: 2, z: 3 }); world.step()
check('parallel nearby walls do not cause unnecessary pull-in', cameraClearance(physics, origin, forward, 6.5, probe) === 6.5)
const release = (fps: number) => { let d = 2; for (let i = 0; i < fps; i++) d = stepCameraDistance(d, 6.5, 1 / fps); return d }
check('camera releases smoothly and independently of 30/60/144 FPS', Math.abs(release(30) - release(144)) < 1e-8 && release(60) < 6.5)
world.free()

// Actual city building footprints: every facade remains outside the camera volume.
const city = new RAPIER.World({ x: 0, y: 0, z: 0 })
for (const c of ENVIRONMENT.colliders) city.createCollider(RAPIER.ColliderDesc.cuboid((c.rect.maxX - c.rect.minX) / 2, (c.y1 - c.y0) / 2, (c.rect.maxZ - c.rect.minZ) / 2).setTranslation((c.rect.minX + c.rect.maxX) / 2, (c.y0 + c.y1) / 2, (c.rect.minZ + c.rect.maxZ) / 2))
city.step()
let penetrations = 0, tooFar = 0
for (const building of ENVIRONMENT.colliders.filter((c) => /^building-\d+$/.test(c.id))) {
  const r = building.rect, cx = (r.minX + r.maxX) / 2, cz = (r.minZ + r.maxZ) / 2
  for (const [x, z, dx, dz] of [[r.minX - 1.5, cz, 1, 0], [r.maxX + 1.5, cz, -1, 0], [cx, r.minZ - 1.5, 0, 1], [cx, r.maxZ + 1.5, 0, -1]]) {
    const focus = new Vector3(x, 1.6, z), direction = new Vector3(dx, 0, dz)
    const distance = cameraClearance({ world: city, rapier: RAPIER }, focus, direction, 6.5, probe)
    const position = focus.addScaledVector(direction, distance)
    if (city.intersectionWithShape(position, { x: 0, y: 0, z: 0, w: 1 }, probe)) penetrations++
    if (distance > 1.21) tooFar++
  }
}
check('80 actual building facade sweeps leave no intersecting camera volume', penetrations === 0 && tooFar === 0, `${penetrations} penetrations`)
city.free()
console.log(fails ? `${fails} FAILED` : 'ALL PASS')
process.exit(fails ? 1 : 0)
