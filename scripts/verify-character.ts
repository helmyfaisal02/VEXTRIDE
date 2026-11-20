/**
 * Headless verification of the character controller against a real Rapier
 * world: speeds, camera-relative input, jumping, walls, ceilings, ramps,
 * step-up, landing, crates, respawn. Run with `bun run verify:character`.
 */
import RAPIER from '@dimforge/rapier3d-compat'
import { createStepProbeResult, probeGround } from '../src/game/character/characterProbes'
import { stepCharacter, createCharacterSim } from '../src/game/character/characterSim'
import { inputState, resetInput, type InputState } from '../src/game/input/inputState'
import { FEET_OFFSET, CAPSULE_HALF_SEGMENT, CAPSULE_RADIUS, GRAVITY_SCALE, SPAWN_POSITION, FIXED_DT, STEP } from '../src/game/character/config'

await RAPIER.init()
let fails = 0
const check = (name: string, ok: boolean, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${info}`); if (!ok) fails++ }

const STEP_HEIGHTS = [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.5, 1.0]

function setup(startX = 0, startZ = 0) {
  const w = new RAPIER.World({ x: 0, y: -9.81, z: 0 }); w.timestep = FIXED_DT
  const fixed = (x: number, y: number, z: number, hx: number, hy: number, hz: number, rot?: {x:number,y:number,z:number,w:number}) => {
    const b = w.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z)); if (rot) b.setRotation(rot, true)
    w.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz), b) }
  fixed(0, -0.5, 0, 500, 0.5, 500)            // ground
  fixed(10, 5, 0, 1, 5, 5)                    // wall at x=9..11
  fixed(-20, 3.2, 0, 3, 1, 3)                 // ceiling slab bottom y=2.2
  // 16deg ramp rising toward +z? ramp along -z: tilt about x
  const ang = 0.28; fixed(0, 1.0, -40, 3, 0.25, 6, { x: Math.sin(ang/2), y: 0, z: 0, w: Math.cos(ang/2) })
  // Step-up lanes: a 6 x 40 m block of each height, front face at z = -8 (lane x = 60 + 10 i).
  STEP_HEIGHTS.forEach((h, i) => fixed(60 + 10 * i, h / 2, -28, 3, h / 2, 20))
  fixed(-40, 3.0, 0, 3, 1, 3)                 // low ceiling slab, bottom y=2.0
  // Staircase: four 0.15 m risers, 0.8 m treads (lane x=-100).
  for (let i = 0; i < 4; i++) fixed(-100, (0.15 * (i + 1)) / 2, -8.4 - i * 0.8, 3, (0.15 * (i + 1)) / 2, 0.4)
  // Ledge at the base of a tall wall (lane x=170): 0.15 m ledge, wall behind it.
  fixed(170, 1.5, -12, 3, 1.5, 0.5); fixed(170, 0.075, -10.75, 3, 0.075, 0.75)
  // Ledge under a low overhang (lane x=180): 0.15 m ledge, slab above at y=1.2.
  fixed(180, 0.075, -10, 3, 0.075, 2); fixed(180, 2.2, -10, 3, 1, 2)
  const body = w.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(startX, FEET_OFFSET + 0.3, startZ).lockRotations().setCanSleep(false).setCcdEnabled(true).setGravityScale(GRAVITY_SCALE).setLinearDamping(0))
  w.createCollider(RAPIER.ColliderDesc.capsule(CAPSULE_HALF_SEGMENT, CAPSULE_RADIUS).setFriction(0).setRestitution(0).setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min).setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Min), body)
  const sim = createCharacterSim(); resetInput()
  const probe = {
    world: w as never,
    ray: { origin: { x: 0, y: 0, z: 0 }, dir: { x: 0, y: -1, z: 0 } },
    staticFlags: RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC | RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
    step: createStepProbeResult(),
  }
  const step = (camX = 0, camZ = -1) => { const g = probeGround(probe, body); stepCharacter(sim, inputState, camX, camZ, body, g, probe); w.step() }
  return { w, body, sim, step, pos: () => body.translation() }
}
const settle = (s: ReturnType<typeof setup>) => { for (let i = 0; i < 90; i++) s.step() }

{ const s = setup(); settle(s)
  check('spawn settles on ground, upright', s.sim.grounded && Math.abs(s.pos().y - FEET_OFFSET) < 0.02, `y=${s.pos().y.toFixed(3)} grounded=${s.sim.grounded}`)
  const r = s.body.rotation(); check('rotation stays identity', Math.abs(r.x)+Math.abs(r.y)+Math.abs(r.z) < 1e-6) }

const speedOf = (keys: Partial<typeof inputState>, camX = 0, camZ = -1) => {
  const s = setup(); settle(s); Object.assign(inputState, keys)
  for (let i = 0; i < 40; i++) s.step(camX, camZ)
  const a = s.pos(); for (let i = 0; i < 30; i++) s.step(camX, camZ); const b = s.pos()
  return { v: Math.hypot(b.x - a.x, b.z - a.z) / 0.5, dx: b.x - a.x, dz: b.z - a.z, y: b.y }
}
const walk = speedOf({ forward: true }); check('walk speed 3.6', Math.abs(walk.v - 3.6) < 0.1, walk.v.toFixed(3))
check('stays on ground while walking', Math.abs(walk.y - FEET_OFFSET) < 0.03, `y=${walk.y.toFixed(3)}`)
const sprint = speedOf({ forward: true, sprint: true }); check('sprint speed 7.2', Math.abs(sprint.v - 7.2) < 0.1, sprint.v.toFixed(3))
check('stays on ground while sprinting', Math.abs(sprint.y - FEET_OFFSET) < 0.03, `y=${sprint.y.toFixed(3)}`)
const diagonals: Array<[string, Partial<InputState>]> = [
  ['fwd+right', { forward: true, right: true }],
  ['fwd+left sprint', { forward: true, left: true, sprint: true }],
  ['back+right', { backward: true, right: true }],
]
for (const [n, k] of diagonals) {
  const d = speedOf(k); const target = k.sprint ? 7.2 : 3.6
  check(`diagonal ${n} speed ${target}`, Math.abs(d.v - target) < 0.1 && Math.abs(d.y - FEET_OFFSET) < 0.03, `${d.v.toFixed(3)} y=${d.y.toFixed(3)}`)
}
check('W moves along camera forward (-Z)', walk.dz < -1 && Math.abs(walk.dx) < 0.01)
const cx = speedOf({ forward: true }, 1, 0); check('camera facing +X: W moves +X', cx.dx > 1 && Math.abs(cx.dz) < 0.01, `dx=${cx.dx.toFixed(2)}`)
const cr = speedOf({ right: true }, 0, -1); check('D = camera right (+X when facing -Z)', cr.dx > 1)
const cr2 = speedOf({ right: true }, 1, 0); check('D with camera +X moves +Z', cr2.dz > 1)
{ const s = setup(); settle(s); inputState.forward = true; const p0 = s.pos(); s.step(); const d1 = Math.hypot(s.pos().x - p0.x, s.pos().z - p0.z) * 60
  check('smooth acceleration (not instant)', d1 < 1.0, `first-step speed ${d1.toFixed(2)}`)
  let t = 0; while (Math.hypot(s.body.linvel().x, s.body.linvel().z) < 3.5 && t < 200) { s.step(); t++ } ; check('reaches walk speed in ~0.1-0.3s', t >= 4 && t < 20, `${t} steps`) }
{ const s = setup(); settle(s); inputState.forward = true; inputState.sprint = true; for (let i=0;i<60;i++) s.step(); resetInput(); let t = 0
  while (Math.hypot(s.body.linvel().x, s.body.linvel().z) > 0.05 && t < 200) { s.step(); t++ }
  check('smooth deceleration to stop', t > 5 && t < 30, `${t} steps, y=${s.pos().y.toFixed(3)}`) }

// jump
{ const s = setup(); settle(s); const ground = s.pos().y; inputState.jumpQueued = true
  let apex = 0, airborne = 0; for (let i = 0; i < 120; i++) { s.step(); apex = Math.max(apex, s.pos().y - ground); if (!s.sim.grounded) airborne++ }
  check('jump apex ~1.4 m', apex > 1.25 && apex < 1.55, apex.toFixed(3))
  check('airtime ~0.7s', airborne > 35 && airborne < 55, `${airborne} steps`)
  check('lands and grounded', s.sim.grounded && Math.abs(s.pos().y - ground) < 0.03, s.pos().y.toFixed(3)) }
{ // spam jump key in air
  const s = setup(); settle(s); const ground = s.pos().y; inputState.jumpQueued = true; let apex = 0, risingAfterApex = false, prev = ground, desc = false
  for (let i = 0; i < 150; i++) { if (i > 2 && i < 30) inputState.jumpQueued = true; s.step(); const y = s.pos().y;  if (y < prev - 1e-4) desc = true; if (desc && y > prev + 1e-3 && !s.sim.grounded) risingAfterApex = true; prev = y; apex = Math.max(apex, y - ground) }
  check('spamming jump in midair: no second jump', apex < 1.55 && !risingAfterApex, `apex ${apex.toFixed(3)}`) }
{ // jump held through (key repeat) -> only buffered presses; sim consumes queued, so single press = single jump
  const s = setup(); settle(s); inputState.jumpQueued = true; let jumps = 0, wasG = true
  for (let i = 0; i < 200; i++) { s.step(); if (wasG && !s.sim.grounded) jumps++; wasG = s.sim.grounded }
  check('single press = exactly one jump', jumps === 1, `jumps=${jumps}`) }

// wall
{ const s = setup(); settle(s); inputState.forward = true; inputState.sprint = true
  for (let i = 0; i < 240; i++) s.step(1, 0)
  const x = s.pos().x; check('stops at wall (face x=9; radius .3 => ~8.7)', x < 8.72 && x > 8.5, `x=${x.toFixed(3)}`)
  check('speed reads ~0 against wall', Math.hypot(s.body.linvel().x, s.body.linvel().z) < 0.3)
  for (let i = 0; i < 400; i++) { if (i % 40 === 0) inputState.jumpQueued = true; s.step(1, 0) }
  check('no tunnelling when sprint-jumping into wall', s.pos().x < 8.8, `x=${s.pos().x.toFixed(3)}`) }
// wall slide diagonal
{ const s = setup(0, -8); settle(s); inputState.forward = true; inputState.right = true; inputState.sprint = true
  for (let i = 0; i < 140; i++) s.step(1, 0.0001) ; const p = s.pos()
  check('slides along wall when moving diagonally', p.x < 8.8 && p.z > 3, `x=${p.x.toFixed(2)} z=${p.z.toFixed(2)}`) }
// ceiling
{ const s = setup(); settle(s); inputState.forward = true; inputState.sprint = true; for (let i = 0; i < 158; i++) s.step(-1, 0)
  inputState.jumpQueued = true; let top = 0; for (let i = 0; i < 40; i++) { s.step(-1, 0); top = Math.max(top, s.pos().y + FEET_OFFSET) }
  check('head stops at ceiling (2.2)', top <= 2.2 + 0.12, `head=${top.toFixed(3)} x=${s.pos().x.toFixed(1)}`) }
// ramp
{ const s = setup(0, -20); settle(s); inputState.forward = true; let y0 = s.pos().y; let g = 0; for (let i = 0; i < 400; i++) { s.step(0, -1); if (s.pos().z < -37 && s.sim.grounded) g++ ; }
    check('climbs 16deg ramp and stays grounded', s.pos().y > y0 + 0.3 && s.sim.grounded && g > 20, `y ${y0.toFixed(2)} -> ${s.pos().y.toFixed(2)} z=${s.pos().z.toFixed(1)}`) }
// ledge: walk off ground end? ground is huge; skip. respawn:
{ const s = setup(); for (let i = 0; i < 10; i++) s.step(); s.body.setTranslation({ x: 700, y: -40, z: 0 }, true); s.step()
  const p = s.pos(); check('kill-plane respawn at spawn', Math.abs(p.y - SPAWN_POSITION[1]) < 0.01 && p.z === SPAWN_POSITION[2], JSON.stringify(p)) }
// crate push
{ const s = setup(); const cb = s.w.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 0.6, -3)); s.w.createCollider(RAPIER.ColliderDesc.cuboid(0.6,0.6,0.6), cb)
  settle(s); inputState.forward = true; for (let i = 0; i < 120; i++) s.step(); const c = cb.translation()
  check('pushes a dynamic crate', c.z < -3.5 && Math.abs(c.y - 0.6) < 0.3, `crate z=${c.z.toFixed(2)} y=${c.y.toFixed(2)}`) }
{ const s = setup(0, -20); settle(s); inputState.forward = true; for (let i = 0; i < 330; i++) s.step(0, -1); resetInput()
  for (let i = 0; i < 30; i++) s.step(0, -1); const a = s.pos(); for (let i = 0; i < 120; i++) s.step(0, -1); const b = s.pos()
  check('stands still on the ramp (no slide)', Math.hypot(b.x-a.x, b.y-a.y, b.z-a.z) < 0.05, `drift ${Math.hypot(b.x-a.x, b.y-a.y, b.z-a.z).toFixed(3)} at y=${b.y.toFixed(2)} grounded=${s.sim.grounded}`) }

/* ----------------------------- Phase 1.4 tests ----------------------------- */
const REST_Y = FEET_OFFSET

// Step-up: walk (or sprint) at each block from 8 m away along the camera direction.
function climb(heightIndex: number, opts: { sprint?: boolean; camX?: number; camZ?: number; seconds?: number } = {}) {
  const lane = 60 + 10 * heightIndex
  const s = setup(lane, 0); settle(s)
  inputState.forward = true; inputState.sprint = !!opts.sprint
  const camX = opts.camX ?? 0, camZ = opts.camZ ?? -1
  let maxVy = 0, maxRisePerStep = 0, prevY = s.pos().y, minY = Infinity, maxY = -Infinity
  const steps = Math.round((opts.seconds ?? 4) * 60)
  const topTrack: number[] = []
  for (let i = 0; i < steps; i++) {
    s.step(camX, camZ)
    const y = s.pos().y; maxVy = Math.max(maxVy, s.body.linvel().y); maxRisePerStep = Math.max(maxRisePerStep, y - prevY); prevY = y
    minY = Math.min(minY, y); maxY = Math.max(maxY, y)
    if (i > steps - 60) topTrack.push(y)
  }
  const p = s.pos()
  return { z: p.z, y: p.y, maxVy, maxRisePerStep, grounded: s.sim.grounded, settledRange: Math.max(...topTrack) - Math.min(...topTrack) }
}
for (const sprint of [false, true]) {
  const label = sprint ? 'sprinting' : 'walking'
  STEP_HEIGHTS.forEach((h, i) => {
    const r = climb(i, { sprint, seconds: sprint ? 3 : 5 })
    if (h <= STEP.maxHeight + 1e-9) {
      check(`step-up ${label}: ${h.toFixed(2)} m ledge is climbed`, r.z < -9 && Math.abs(r.y - (REST_Y + h)) < 0.03 && r.grounded, `z=${r.z.toFixed(2)} y=${r.y.toFixed(3)} (want ${(REST_Y + h).toFixed(3)})`)
      check(`step-up ${label}: ${h.toFixed(2)} m climb is gentle (no launch, no jitter)`, r.maxVy < STEP.climbSpeed + 2 && r.maxRisePerStep < 0.09 && r.settledRange < 0.01, `maxVy=${r.maxVy.toFixed(2)} maxRise/step=${r.maxRisePerStep.toFixed(3)} settled=${r.settledRange.toFixed(4)}`)
    } else {
      check(`step-up ${label}: ${h.toFixed(2)} m obstacle blocks`, r.z > -7.75 && Math.abs(r.y - REST_Y) < 0.03, `z=${r.z.toFixed(2)} y=${r.y.toFixed(3)}`)
    }
  })
}
{ const r = climb(2, { camX: 0.5, camZ: -0.866 }); check('step-up at a 30 degree angle', r.y > REST_Y + 0.12 && r.grounded, `y=${r.y.toFixed(3)} z=${r.z.toFixed(2)}`) }
{ // Step-up must not change speeds: measure ground speed on the flat after climbing a ledge.
  const s = setup(60 + 10 * 2, 0); settle(s); inputState.forward = true; inputState.sprint = true
  for (let i = 0; i < 240; i++) s.step(); const a = s.pos(); for (let i = 0; i < 20; i++) s.step(); const b = s.pos()
  check('sprint speed preserved on top of a ledge', Math.abs(Math.hypot(b.x - a.x, b.z - a.z) * 3 - 7.2) < 0.15, `${(Math.hypot(b.x - a.x, b.z - a.z) * 3).toFixed(3)} m/s`) }
{ const s = setup(60 + 10 * 2, 0); settle(s); const v: number[] = []; inputState.forward = true
  for (let i = 0; i < 300; i++) { s.step(); v.push(s.sim.grounded ? 1 : 0) }
  check('grounded state is not lost while stepping up (no spurious air time)', v.slice(0, 120).filter((x) => x === 0).length < 10, `${v.filter((x) => x === 0).length} airborne steps`) }
{ // Stairs of 0.15 risers are climbable end to end.
  const s = setup(-100, 0); settle(s); inputState.forward = true; let top = 0, topZ = 0; for (let i = 0; i < 360; i++) { s.step(); if (s.pos().y > top) { top = s.pos().y; topZ = s.pos().z } }
  check('staircase of 0.15 m risers is climbed to the top (0.60 m)', top > REST_Y + 0.55, `peak y=${top.toFixed(3)} at z=${topZ.toFixed(2)}`) }
{ // Exploit checks: no scaling of walls via a small ledge, no stepping under an overhang.
  const s = setup(170, 0); settle(s); inputState.forward = true; inputState.sprint = true; let maxY = 0
  for (let i = 0; i < 480; i++) { if (i % 30 === 0) s.step(); s.step(); maxY = Math.max(maxY, s.pos().y) }
  check('a tall wall with a 0.15 m ledge cannot be climbed', maxY < REST_Y + 0.2 && s.pos().z > -11.25, `maxY=${maxY.toFixed(3)} z=${s.pos().z.toFixed(2)}`)
  const o = setup(180, 0); settle(o); inputState.forward = true; for (let i = 0; i < 300; i++) o.step()
  check('no step-up under a low overhang', o.pos().z > -7.9 && o.pos().y < REST_Y + 0.05, `z=${o.pos().z.toFixed(2)} y=${o.pos().y.toFixed(3)}`) }
{ // Walking into a wall repeatedly never lifts the character.
  const s = setup(0, 0); settle(s); inputState.forward = true; let maxY = 0
  for (let i = 0; i < 300; i++) { s.step(1, 0); maxY = Math.max(maxY, s.pos().y) }
  check('pressing against a tall wall never lifts the body', maxY < REST_Y + 0.02, `maxY=${maxY.toFixed(3)}`) }
{ // Slope handling is unchanged by step-up (ramp is climbed without step triggers).
  const s = setup(0, -20); settle(s); inputState.forward = true; let maxRise = 0, prev = s.pos().y
  for (let i = 0; i < 400; i++) { s.step(0, -1); maxRise = Math.max(maxRise, s.pos().y - prev); prev = s.pos().y }
  check('ramp: smooth climb, no step-up spikes', maxRise < 0.04 && s.pos().y > REST_Y + 1, `maxRise/step=${maxRise.toFixed(4)} y=${s.pos().y.toFixed(2)}`) }

// Ceilings: the head must stop at the surface (previously overshot by ~9 cm).
function walkUnder(laneX: number, sprinting: boolean) {
  const s = setup(laneX + (sprinting ? 6 : 4), 0); settle(s)
  inputState.forward = true; inputState.sprint = sprinting
  for (let i = 0; i < 400 && s.pos().x > laneX + (sprinting ? 1.5 : 0.5); i++) s.step(-1, 0)
  return s
}
function ceilingTest(laneX: number, bottom: number, label: string, sprinting: boolean) {
  const s = walkUnder(laneX, sprinting)
  if (!sprinting) resetInput()
  for (let i = 0; i < 20; i++) s.step(-1, 0)
  let head = 0, jumps = 0, wasG = true
  const presses = sprinting ? 1 : 5
  for (let n = 0; n < presses; n++) {
    inputState.jumpQueued = true
    for (let i = 0; i < (sprinting ? 40 : 50); i++) {
      s.step(-1, 0)
      if (Math.abs(s.pos().x - laneX) < 2.5) head = Math.max(head, s.pos().y + FEET_OFFSET)
      if (wasG && !s.sim.grounded) jumps++
      wasG = s.sim.grounded
    }
  }
  check(`ceiling ${label}: head stops at the slab (${bottom.toFixed(1)} m)`, head > bottom - 0.3 && head <= bottom + 0.01, `head=${head.toFixed(4)} overshoot=${((head - bottom) * 1000).toFixed(1)} mm`)
  for (let i = 0; i < 120; i++) s.step(-1, 0)
  check(`ceiling ${label}: lands normally, one jump per press`, s.sim.grounded && Math.abs(s.pos().y - REST_Y) < 0.03 && jumps === presses, `jumps=${jumps}/${presses} y=${s.pos().y.toFixed(3)}`)
}
ceilingTest(-20, 2.2, 'walking under a 2.2 m slab', false)
ceilingTest(-20, 2.2, 'sprinting under a 2.2 m slab', true)
ceilingTest(-40, 2.0, 'under a 2.0 m slab', false)
{ // Standing jump straight into a ceiling, with jump presses repeated mid-air.
  const s = walkUnder(-40, false); resetInput(); for (let i = 0; i < 20; i++) s.step(-1, 0)
  let head = 0; inputState.jumpQueued = true
  for (let i = 0; i < 150; i++) { if (i > 3 && i < 20) inputState.jumpQueued = true; s.step(-1, 0); head = Math.max(head, s.pos().y + FEET_OFFSET) }
  check('ceiling: mid-air jump spam beneath a slab cannot push through it', head <= 2.0 + 0.01, `head=${head.toFixed(4)}`) }
{ // Open sky: the jump is exactly as high as before.
  const s = setup(0, 0); settle(s); const g = s.pos().y; let apex = 0; inputState.jumpQueued = true
  for (let i = 0; i < 90; i++) { s.step(); apex = Math.max(apex, s.pos().y - g) }
  check('jump height unchanged in open space (1.38 m)', Math.abs(apex - 1.383) < 0.03, apex.toFixed(3)) }

// Landing stability.
{ const s = setup(0, 0); s.body.setTranslation({ x: 0, y: 6, z: 0 }, true); let minY = Infinity, bounce = 0, landed = -1
  for (let i = 0; i < 240; i++) { s.step(); const y = s.pos().y; if (landed < 0 && s.sim.grounded && y < REST_Y + 0.05) landed = i; if (landed >= 0) { minY = Math.min(minY, y); if (i > landed + 3) bounce = Math.max(bounce, y - REST_Y) } }
  check('landing from a 5 m drop: no sink-in (< 5 mm)', REST_Y - minY < 0.005, `dip=${((REST_Y - minY) * 1000).toFixed(1)} mm`)
  check('landing from a 5 m drop: no bounce, settles on the ground', bounce < 0.012 && Math.abs(s.pos().y - REST_Y) < 0.012, `bounce=${(bounce * 1000).toFixed(1)} mm final=${s.pos().y.toFixed(4)}`) }
{ const s = setup(0, 0); settle(s); const g = s.pos().y; inputState.jumpQueued = true; let minY = Infinity, started = false
  for (let i = 0; i < 120; i++) { s.step(); const y = s.pos().y; if (y > g + 0.5) started = true; if (started && i > 30) minY = Math.min(minY, y) }
  check('landing from a normal jump: dip under 5 mm', started && g - minY < 0.005, `dip=${((g - minY) * 1000).toFixed(1)} mm`) }
{ const s = setup(0, 0); settle(s); inputState.forward = true; inputState.sprint = true; for (let i = 0; i < 90; i++) s.step(); resetInput()
  let lo = Infinity, hi = -Infinity; for (let i = 0; i < 120; i++) { s.step(); lo = Math.min(lo, s.pos().y); hi = Math.max(hi, s.pos().y) }
  check('stopping from a sprint: no vertical oscillation (< 3 mm)', hi - lo < 0.003, `range=${((hi - lo) * 1000).toFixed(2)} mm`)
  check('stopping: rests on the floor, not floating (< 12 mm)', Math.abs(s.pos().y - REST_Y) < 0.012, `y=${s.pos().y.toFixed(4)}`) }
{ // Landing while moving, sprint-jump across flat ground repeatedly.
  const s = setup(0, 0); settle(s); inputState.forward = true; inputState.sprint = true; let minY = Infinity
  for (let i = 0; i < 360; i++) { if (i % 60 === 0) inputState.jumpQueued = true; s.step(1, 0); if (i % 60 > 40) minY = Math.min(minY, s.pos().y) }
  check('repeated sprint-jump landings stay on the floor', REST_Y - minY < 0.006, `dip=${((REST_Y - minY) * 1000).toFixed(1)} mm`) }
{ // Frame-rate independence: the controller only advances in fixed steps, so any render rate gives the same path.
  const run = (renderHz: number) => {
    const s = setup(0, 0); settle(s); inputState.forward = true; inputState.sprint = true
    let acc = 0, steps = 0; const dt = 1 / renderHz
    for (let f = 0; f < renderHz * 2; f++) { acc += dt; while (acc >= FIXED_DT - 1e-9) { s.step(); acc -= FIXED_DT; steps++ } }
    return { z: s.pos().z, steps }
  }
  const a = run(30), b = run(60), c = run(144)
  check('same distance after 2 s at 30 / 60 / 144 fps', Math.abs(a.z - b.z) < 0.15 && Math.abs(b.z - c.z) < 0.15, `z=${a.z.toFixed(2)} / ${b.z.toFixed(2)} / ${c.z.toFixed(2)}`) }

console.log(fails === 0 ? 'ALL PASS' : `${fails} FAILED`); process.exit(fails ? 1 : 0)
