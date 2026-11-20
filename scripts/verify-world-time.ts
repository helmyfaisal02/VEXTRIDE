import assert from 'node:assert/strict'
import { Color } from 'three'
import { createLightingState, nightAmount, updateLighting } from '../src/game/world/dayNight'
import { DAY_SECONDS, advanceHour, formatWorldTime, parseTimeSetting, timePeriod, WorldClock } from '../src/game/world/worldTime'
import { buildEnvironmentGeometry } from '../src/game/environment/envGeometry'
import { PAL } from '../src/game/environment/envPalette'

let checks = 0
function test(name: string, run: () => void) { run(); checks++; console.log(`PASS  ${name}`) }
const close = (a: number, b: number, tolerance = 1e-7) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`)

test('fresh clock starts automatically at 10 AM; period and 12-hour formatting', () => {
  const clock = new WorldClock()
  assert.equal(clock.hour, 10)
  assert.equal(clock.paused, false)
  for (const [hour, label] of [[0, '12:00 AM'], [10, '10:00 AM'], [12, '12:00 PM'], [23.5, '11:30 PM']] as const) assert.equal(formatWorldTime(hour), label)
  assert.deepEqual([4, 5, 7, 17, 19].map(timePeriod), ['Nighttime', 'Sunrise', 'Daytime', 'Sunset', 'Nighttime'])
})
test('30 real minutes per full day at 30, 60 and 144 FPS; midnight wrap', () => {
  for (const fps of [30, 60, 144]) {
    const clock = new WorldClock()
    for (let i = 0; i < DAY_SECONDS * fps; i++) clock.advance(1 / fps)
    close(clock.hour, 10)
  }
  close(advanceHour(23.999, 0.1), 0.0003333333333)
})
test('pause/resume, developer changes, hidden tabs and invalid/stall deltas', () => {
  const clock = new WorldClock()
  clock.setHour(18)
  clock.setPaused(true)
  clock.advance(0.5)
  close(clock.hour, 18)
  clock.setPaused(false)
  clock.advance(0.5)
  close(clock.hour, 18 + 0.5 * 24 / DAY_SECONDS)
  const before = clock.hour
  clock.advance(0.5, true)
  for (const delta of [120, -1, NaN, Infinity]) clock.advance(delta)
  close(clock.hour, before)
  clock.setHour(-1)
  close(clock.hour, 23)
  clock.setHour(NaN)
  close(clock.hour, 23)
})
test('subscribers update only at minute boundaries or explicit edits and unsubscribe cleanly', () => {
  const clock = new WorldClock()
  let calls = 0
  const unsubscribe = clock.subscribe(() => calls++)
  for (let i = 0; i < 60; i++) clock.advance(1 / 60)
  assert.equal(calls, 0)
  clock.advance(0.5)
  assert.equal(calls, 1)
  clock.setPaused(true)
  assert.equal(calls, 2)
  unsubscribe()
  clock.setHour(1)
  assert.equal(calls, 2)
})
test('separate versioned persistence validates corrupt/unsupported settings and restores pause', () => {
  for (const raw of [null, '{', '{}', '{"version":2,"hour":10,"paused":false}', '{"version":1,"hour":24,"paused":false}', '{"version":1,"hour":"10","paused":false}']) assert.equal(parseTimeSetting(raw), null)
  const a = new WorldClock(), b = new WorldClock()
  a.setHour(20.5); a.setPaused(true)
  b.restore(parseTimeSetting(JSON.stringify(a.setting()))!)
  close(b.hour, 20.5)
  assert.equal(b.paused, true)
})
test('streetlights blend monotonically through sunrise/sunset and stay bounded over 24 hours', () => {
  assert.equal(nightAmount(0), 1)
  assert.equal(nightAmount(7), 0)
  assert.equal(nightAmount(17), 0)
  assert.equal(nightAmount(19), 1)
  close(nightAmount(6), 0.5)
  close(nightAmount(18), 0.5)
  for (let h = 0; h < 24; h += 0.01) {
    assert.ok(nightAmount(h) >= 0 && nightAmount(h) <= 1)
    if (h >= 5 && h < 7) assert.ok(nightAmount(h + 0.001) <= nightAmount(h))
    if (h >= 17 && h < 19) assert.ok(nightAmount(h + 0.001) >= nightAmount(h))
  }
})
test('sky, fog, sun direction/intensity remain continuous at boundaries and midnight', () => {
  for (const h of [0, 5, 6, 7, 10, 16, 17, 18, 19, 24]) {
    const a = updateLighting(h - 0.00001, createLightingState())
    const b = updateLighting(h + 0.00001, createLightingState())
    for (const key of ['top', 'mid', 'horizon', 'sun'] as const) {
      close(a[key].r, b[key].r, 0.0001); close(a[key].g, b[key].g, 0.0001); close(a[key].b, b[key].b, 0.0001)
    }
    assert.ok(a.sunDirection.distanceTo(b.sunDirection) < 0.0001)
    close(a.sunIntensity, b.sunIntensity, 0.0001)
  }
  const noon = updateLighting(12, createLightingState()), night = updateLighting(0, createLightingState())
  assert.ok(noon.sunDirection.y > 0 && night.sunDirection.y < 0)
  assert.equal(night.sunIntensity, 0)
  assert.ok(noon.sunIntensity > 2 && night.ambientIntensity > 0 && night.ambientIntensity < noon.ambientIntensity)
})
test('window and lamp masks are deterministic on merged geometry; only selected surfaces emit', () => {
  const a = buildEnvironmentGeometry(), b = buildEnvironmentGeometry()
  const window = new Color(PAL.glassWarm), lamp = new Color(PAL.lampGlow)
  let windows = 0, lamps = 0, unlit = 0
  a.chunks.forEach((chunk, index) => {
    const mask = chunk.geometry.getAttribute('nightEmission'), colors = chunk.geometry.getAttribute('color')
    assert.deepEqual(mask.array, b.chunks[index].geometry.getAttribute('nightEmission').array)
    assert.equal(mask.count, colors.count)
    for (let i = 0; i < mask.count; i++) {
      const color = new Color().setRGB(colors.getX(i), colors.getY(i), colors.getZ(i))
      if (mask.getX(i) > 2) { assert.ok(color.equals(lamp) || color.clone().sub(lamp).toArray().every((v) => Math.abs(v) < 1e-5)); lamps++ }
      else if (mask.getX(i) > 0) { assert.ok(color.clone().sub(window).toArray().every((v) => Math.abs(v) < 1e-5)); windows++ }
      else unlit++
    }
    const indices = chunk.geometry.getIndex()!
    for (let i = 0; i < indices.count; i += 3) {
      assert.equal(mask.getX(indices.getX(i)), mask.getX(indices.getX(i + 1)))
      assert.equal(mask.getX(indices.getX(i)), mask.getX(indices.getX(i + 2)))
    }
  })
  assert.ok(windows > 100 && lamps > 100 && unlit > windows)
  assert.equal(a.stats.drawCalls, 12)
  for (const env of [a, b]) {
    env.chunks.forEach((chunk) => chunk.geometry.dispose())
    env.paintBase.dispose(); env.paintLines.dispose(); env.signs.geometry.dispose()
  }
})
console.log(`ALL PASS (${checks} world-time groups)`)
