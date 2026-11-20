/**
 * Verifies the camera hand-over maths: time-based blending that is identical at
 * any frame rate, no invalid (non-finite or denormalised) poses, safe handling
 * of bad input and long stalls, seamless entry to the orbit camera, and the
 * creator's view-offset easing. Run with `bun run verify:camera`.
 */
import { PerspectiveCamera, Quaternion, Vector3 } from 'three'
import { selectActiveCamera } from '../src/game/camera/CameraDirector'
import {
  applyViewOffset,
  beginCameraTransition,
  cameraTransitionProgress,
  computeViewOffsetTarget,
  isCameraTransitioning,
  MAX_FRAME_DT,
  orbitTargetFromView,
  poseCamera,
  smootherstep,
  stepViewOffset,
  TRANSITION_DURATION,
  type ViewOffset,
} from '../src/game/camera/cameraTransition'

let fails = 0
const check = (name: string, ok: boolean, info = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${info}`)
  if (!ok) fails++
}

const cameraAt = (x: number, y: number, z: number, lx = 0, ly = 1, lz = 0) => {
  const c = new PerspectiveCamera(55, 1.6, 0.1, 1500)
  c.position.set(x, y, z)
  c.lookAt(lx, ly, lz)
  return c
}
const valid = (c: PerspectiveCamera) =>
  [c.position.x, c.position.y, c.position.z, c.quaternion.x, c.quaternion.y, c.quaternion.z, c.quaternion.w].every(Number.isFinite) &&
  Math.abs(c.quaternion.length() - 1) < 1e-6

/** Preview-like pose (close, in front) -> gameplay-like pose (far, behind), at a given frame rate. */
function run(fps: number, seconds: number, mutate?: (frame: number, cam: PerspectiveCamera) => void) {
  const cam = cameraAt(2, 1.4, 4, 0, 0.9, 0) // preview
  const to = new Vector3(0, 3, 9), look = new Vector3(0, 1.5, 0) // follow
  beginCameraTransition(cam)
  const dt = 1 / fps
  const samples: { t: number; pos: Vector3; q: Quaternion }[] = []
  let maxStep = 0, prev = cam.position.clone(), allValid = true
  const frames = Math.round(seconds * fps)
  for (let f = 0; f < frames; f++) {
    mutate?.(f, cam)
    poseCamera(cam, to, look, dt)
    maxStep = Math.max(maxStep, cam.position.distanceTo(prev)); prev = cam.position.clone()
    if (!valid(cam)) allValid = false
    samples.push({ t: (f + 1) * dt, pos: cam.position.clone(), q: cam.quaternion.clone() })
  }
  return { cam, samples, maxStep, allValid, to, look }
}

/* ---------------------------------- maths --------------------------------- */
check('smootherstep: 0 -> 0, 1 -> 1, monotonic, clamped', smootherstep(0) === 0 && smootherstep(1) === 1 && smootherstep(-3) === 0 && smootherstep(9) === 1 && Array.from({ length: 100 }, (_, i) => smootherstep(i / 100) <= smootherstep((i + 1) / 100)).every(Boolean))

/* ------------------------------ time-based blend --------------------------- */
const r30 = run(30, 1.2), r60 = run(60, 1.2), r144 = run(144, 1.2)
const start = new Vector3(2, 1.4, 4)
for (const [fps, r] of [[30, r30], [60, r60], [144, r144]] as const) {
  // Position must equal the analytic easing of elapsed time, whatever the frame rate.
  const worst = r.samples.reduce((m, s) => Math.max(m, s.pos.distanceTo(start.clone().lerp(r.to, smootherstep(s.t / TRANSITION_DURATION)))), 0)
  check(`${fps} fps: position follows the time-based easing curve exactly`, worst < 1e-6, `max error ${worst.toExponential(1)}`)
}
for (const [name, r] of [['30', r30], ['60', r60], ['144', r144]] as const) {
  const want = cameraAt(r.to.x, r.to.y, r.to.z, r.look.x, r.look.y, r.look.z)
  check(`${name} fps: ends exactly on the target pose`, r.cam.position.distanceTo(r.to) < 1e-6 && r.cam.quaternion.angleTo(want.quaternion) < 1e-6 && !isCameraTransitioning())
  check(`${name} fps: every frame is a valid pose`, r.allValid)
}
{ // No teleporting: per-frame travel never exceeds the peak speed of the easing curve.
  const path = new Vector3(2, 1.4, 4).distanceTo(new Vector3(0, 3, 9))
  for (const [fps, r] of [[30, r30], [60, r60], [144, r144]] as const) {
    const limit = (path * 1.875) / TRANSITION_DURATION / fps * 1.05 + 1e-6
    check(`${fps} fps: no camera jump (max step ${r.maxStep.toFixed(3)} <= ${limit.toFixed(3)})`, r.maxStep <= limit)
  }
}
{ const dur = r60.samples.find((s) => s.pos.distanceTo(r60.to) < 1e-6)
  check('blend takes the configured duration', !!dur && Math.abs(dur.t - TRANSITION_DURATION) < 0.05, `done at ${dur?.t.toFixed(3)}s (want ${TRANSITION_DURATION})`) }
{ // Rotation takes the short way round and is continuous.
  let maxTurn = 0; let prevQ = new Quaternion(); const cam = cameraAt(0, 2, 6, 0, 1, 0); beginCameraTransition(cam); prevQ = cam.quaternion.clone()
  for (let f = 0; f < 90; f++) { poseCamera(cam, new Vector3(-6, 2, -1), new Vector3(0, 1, 0), 1 / 60); maxTurn = Math.max(maxTurn, cam.quaternion.angleTo(prevQ)); prevQ = cam.quaternion.clone() }
  check('rotation is continuous (no sudden flips)', maxTurn < 0.1, `max ${maxTurn.toFixed(3)} rad/frame`) }

/* --------------------------- robustness / bad input ------------------------ */
{ const cam = cameraAt(1, 2, 3); beginCameraTransition(cam); const p = cam.position.clone(), q = cam.quaternion.clone()
  poseCamera(cam, new Vector3(Number.NaN, 1, 1), new Vector3(0, 0, 0), 1 / 60)
  poseCamera(cam, new Vector3(1, 1, 1), new Vector3(0, Infinity, 0), 1 / 60)
  poseCamera(cam, new Vector3(1, 1, 1), new Vector3(0, 0, 0), Number.NaN)
  check('non-finite targets or time leave the camera untouched', cam.position.equals(p) && cam.quaternion.equals(q) && valid(cam)) }
{ const cam = cameraAt(0, 1, 5); beginCameraTransition(cam); poseCamera(cam, new Vector3(0, 3, 12), new Vector3(0, 1, 0), 5)
  check('a stalled frame (5 s) cannot skip the blend', isCameraTransitioning() && cameraTransitionProgress() <= MAX_FRAME_DT / TRANSITION_DURATION + 1e-9 && valid(cam), `progress=${cameraTransitionProgress().toFixed(3)}`) }
{ const cam = cameraAt(0, 1, 5); beginCameraTransition(cam); poseCamera(cam, new Vector3(0, 3, 12), new Vector3(0, 1, 0), -1)
  check('negative time cannot run the blend backwards', cameraTransitionProgress() === 0 && valid(cam)) }
{ // Switching again mid-blend restarts from the pose the camera actually has: no jump.
  const cam = cameraAt(0, 1, 5); const to1 = new Vector3(0, 3, 12), look = new Vector3(0, 1, 0)
  beginCameraTransition(cam); for (let f = 0; f < 20; f++) poseCamera(cam, to1, look, 1 / 60)
  const before = cam.position.clone(), bq = cam.quaternion.clone(); beginCameraTransition(cam); poseCamera(cam, new Vector3(8, 2, 0), look, 0)
  check('re-triggering mid-transition starts from the current pose (no teleport)', cam.position.distanceTo(before) < 1e-6 && cam.quaternion.angleTo(bq) < 1e-6) }
{ const cam = cameraAt(3, 3, 3); const to = new Vector3(3, 3, 3), look = new Vector3(0, 1, 0); beginCameraTransition(cam); const q = cam.quaternion.clone()
  for (let f = 0; f < 60; f++) poseCamera(cam, to, look, 1 / 60)
  check('identical start and target stays put', cam.position.distanceTo(to) < 1e-9 && cam.quaternion.angleTo(q) < 1e-9) }

/* ---------------------------- orbit camera entry --------------------------- */
{ const cam = cameraAt(0, 4, 10, 0, 1, 0); const dir = cam.getWorldDirection(new Vector3()); const player = new Vector3(0, 0.9, 0)
  const t = orbitTargetFromView(cam.position, dir, player, new Vector3())
  const check2 = cameraAt(0, 4, 10, t.x, t.y, t.z)
  check('orbit target keeps the view direction (no turn on entry)', check2.quaternion.angleTo(cam.quaternion) < 1e-6 && Number.isFinite(t.x + t.y + t.z))
  const near = orbitTargetFromView(player.clone(), dir, player, new Vector3())
  check('orbit target is safe when the camera is on the player', Number.isFinite(near.x + near.y + near.z) && near.distanceTo(player) >= 5.9)
  const far = orbitTargetFromView(new Vector3(0, 400, 0), new Vector3(0, -1, 0), player, new Vector3())
  check('orbit target distance is clamped (<= 60 m)', far.distanceTo(new Vector3(0, 400, 0)) <= 60 + 1e-6) }

/* ----------------------- exactly one camera system runs -------------------- */
{ const modes = ['follow', 'orbit'] as const
  check('creator open: the preview camera is the only one', modes.every((m) => selectActiveCamera(true, m) === 'preview'))
  check('creator closed: the selected gameplay camera is the only one', selectActiveCamera(false, 'follow') === 'follow' && selectActiveCamera(false, 'orbit') === 'orbit') }

/* --------------------------- creator view offset --------------------------- */
{ const o: ViewOffset = { x: 0, y: 0 }
  computeViewOffsetTarget(1280, 720, true, o); check('desktop: character shifts right of the panel', o.x < 0 && o.y === 0, `x=${o.x}`)
  computeViewOffsetTarget(390, 800, true, o); check('narrow: character shifts above the bottom sheet', o.x === 0 && o.y > 0, `y=${o.y}`)
  computeViewOffsetTarget(1280, 720, false, o); check('creator closed: no offset', o.x === 0 && o.y === 0)
  const target: ViewOffset = { x: -210, y: 0 }
  const settle = (fps: number) => { const c: ViewOffset = { x: 0, y: 0 }; for (let f = 0; f < fps * 0.4; f++) stepViewOffset(c, target, 1 / fps); return c.x }
  check('view offset easing is frame-rate independent', Math.abs(settle(30) - settle(144)) < 1.5, `${settle(30).toFixed(1)} vs ${settle(144).toFixed(1)}`)
  const c: ViewOffset = { x: 0, y: 0 }; for (let f = 0; f < 600; f++) stepViewOffset(c, target, 1 / 60)
  check('view offset settles exactly on the target', c.x === -210 && c.y === 0)
  const cam = cameraAt(0, 1, 5); applyViewOffset(cam, 1280, 720, { x: -210, y: 0 })
  check('applyViewOffset sets the camera view', cam.view !== null && cam.view.enabled && cam.view.offsetX === -210)
  applyViewOffset(cam, 1280, 720, { x: 0, y: 0 })
  check('a zero offset clears the camera view (back to the normal projection)', cam.view?.enabled === false) }

console.log(fails === 0 ? 'ALL PASS' : `${fails} FAILED`)
process.exit(fails ? 1 : 0)
