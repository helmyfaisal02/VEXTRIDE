# VEXTRIDE Phase 3.4 — Vehicle System Stabilization

Implementation and local validation report. Manual acceptance remains pending. No Phase 4 work.

## 1. Initial repository inspection

Started from clean `main...origin/main`, HEAD `11943d5` (`feat: polish VEXTRIDE driving and vehicle recovery`). Phase 3.3 was committed. Local identity: `helmyfaisal02` / `hijautua39@gmail.com`, unchanged.

Inspected Vehicle/VehicleSystem, all three model/configuration definitions, simulation/state/interaction/recovery/signals, chase camera and CameraDirector, HUD, shared keyboard/pointer input, Rapier lifecycle, city/environment collision fixtures, Phase 2.4 curb cuts, world lighting integration and existing vehicle tests. Baseline `bun run verify:all` passed with all 743 existing PASS cases/groups.

## 2. Defects and targeted corrections

**Occupied component removal stranded the player.** A mounted real-Rapier test reproduced two failures: removing the occupied car retained driving ownership and left the pedestrian body disabled. Vehicle now performs ownership/input cleanup before Rapier's passive body removal. It restores the pedestrian through supported-ground/capsule/path clearance queries while the car still exists. Teardown queries can additionally consider the disappearing chassis's center and ignore that chassis; ordinary E exits retain their previous collision checks. Registry cleanup and asset disposal remain in the existing passive cleanup.

The cleanup depends on stable world/engine handles, so Physics context changes such as P debug do not release an occupied car. A new regression exercises this while driving.

**Collision relocation could leave the chase camera aimed away.** The existing post-handoff volume sweep moved the camera out of a wall but retained the blended orientation for the old position. The vehicle-only correction now re-aims at the vehicle focus when that safety correction actually moves the camera. Unobstructed handoff orientation, normal follow tuning, user orbit/zoom, distance release and CameraDirector are unchanged. Real Rapier tests check focus alignment, volume clearance and unchanged unobstructed orientation.

No physics or handling instability requiring retuning was reproduced. No accepted handling values, speed caps, vehicle models or city collisions were changed. Removing one car did not dispose surviving cars' shared materials in the lifecycle test, so no speculative material-ownership refactor was made.

## 3. Files

Modified:

- `src/game/vehicles/Vehicle.tsx`: validated active-vehicle teardown and stable cleanup dependencies.
- `src/game/vehicles/vehicleInteraction.ts`: teardown-only supported-space candidate/clearance option; normal entry/exit defaults preserved.
- `src/game/camera/VehicleCamera.tsx`: call the vehicle-specific correction after handoff blending.
- `package.json`: append `verify:vehicle-endurance` and `verify:vehicle-stability` to `verify:all`.

Created:

- `src/game/camera/vehicleCameraCollision.ts`: small collision relocation/focus correction using the existing sweep utility and reusable vectors.
- `scripts/verify-vehicle-endurance.ts`: sustained physics, render scheduling, signal cycling, camera and representative collision coverage.
- `scripts/verify-vehicle-stability.tsx`: mounted lifecycle, switching, focus, repeat, remount/disposal and listener regressions.
- This report and `docs/phase34/`: actual browser result JSON/screenshots.

No dependencies/lockfile, input architecture, HUD design, vehicle tuning/models, recovery algorithm, world-time/lighting, city/environment data, character controller/persistence, original tests or Git configuration were changed.

## 4. Sustained physics and handling

Each vehicle completed **108,000 fixed steps: 30 simulated minutes** of acceleration, coasting, braking/reverse, steering changes and handbrake activation/release. Across all three cars that is 324,000 primary sustained steps. The test uses a bounded real Rapier arena, not a claim of 90 minutes of browser driving through the city.

Observed peaks:

| Vehicle | Peak forward speed | Peak chassis Y on flat ground |
|---|---:|---:|
| Street Coupe | 21.99 m/s | 0.529 m |
| City Sedan | 17.99 m/s | 0.579 m |
| Utility Pickup | 14.99 m/s | 0.679 m |

All sampled poses, velocities, rotations and wheel angles remained finite; speeds stayed within configured forward/reverse caps; bodies remained upright and supported. After settling, parked bodies slept and wheel roll/position stopped changing. Body/collider counts remained constant.

Each definition also completed identical 7,200-step replays under synthetic 15/30/60/144 FPS accumulator scheduling. Final positions, headings, speeds and wheel rolls matched within tolerance. These are fixed-step scheduling tests, not hardware renderer benchmarks.

Existing suites continue to cover all 40 actual roads, four-way/T junctions, four curb cuts, uncut curbs, garage/showroom collisions, grounded driving, high-speed caps, braking and distinct handling. Added CCD tests reuse representative real building, trunk, pole, bench and container dimensions in isolated fixtures; low furniture may be physically climbed rather than treated as an infinitely tall barrier. The full original city collision fixtures/tests remain intact.

## 5. Interaction lifecycle

The mounted harness uses the original Player, VehicleSystem, shared keyboard hook, CameraDirector, city/environment colliders and real Rapier world. Twelve enter/exit cycles switch among all three cars. Validated approach fixtures place the pedestrian near the selected car; no vehicle-selection menu was added.

Checks cover nearest eligible IDs, clearing held steering/throttle on mode changes, E repeat suppression, focus-loss resets, passive settling, safe capsule exits, walking restoration, active-car removal, null registry references and finite camera state. Existing tests preserve through-wall rejection, entry range, blocked exits, only-active input, independent parked poses, dynamic collision and wheel animation.

## 6. Recovery audit

The Phase 3.3 recovery algorithm is unchanged. Its existing real-Rapier tests remain passing: sustained overturn/blockage, one-second hold, throttle-release window and cancellation, normal-driving/airborne rejection, partial hold release, other-car clearance, supported last-safe placement, validated spawn fallback, fully blocked refusal, upright restoration, velocity/input reset and retained active ID. Endurance runs also exercise ongoing safe-pose sampling without forced recovery or persistence additions.

Browser fixtures use actual held R after controlled rollovers, because upright locks normally prevent natural flips. Recovery remains a validated exception; ordinary driving remains dynamic-body movement.

## 7. Camera and input

Vehicle-only collision correction preserves view of the focus after relocation; the camera's normal feel/tuning is unchanged. Existing camera-volume, facade, handoff, creator-priority and debug-selection regressions continue to pass. The mounted lifecycle test verifies P context updates do not accidentally trigger teardown.

The original single keyboard architecture is unchanged. Repeated switching tests exercise held inputs, E repeats and blur. Original tests retain tab hiding, creator/typing, partial R, Space jump/handbrake and developer-time safeguards. Window listener counts remain stable through switches/remounts and return to zero after final harness unmount.

## 8. HUD and lamps

HUD, speed units, names, hints, recovery messages, headlights and day/night materials are preserved. Three thousand repeated pedal/direction sequences across the three profiles verify brake/reverse signals do not latch: forward throttle, braking, reverse, handbrake and stopped states. Existing mounted tests retain independent brake materials, name/active-target selection and per-car wheel behavior. Browser evidence records active HUD and actual lamp emission/reset.

## 9. Resources and performance

Production still has three vehicle rigid bodies and 22 vehicle colliders. No added meshes, lights, material assets or physics bodies. Camera correction reuses existing query/vector resources and allocates no geometry. Normal driving/recovery tuning remains unchanged.

Four fleet removal/remount cycles preserve body, collider, fixed-step callback and window-listener counts. Each removal releases all 24 vehicle-owned geometries and nine per-car lamp materials; four shared materials survive individual vehicle removal and dispose when the whole system unmounts. Final unmount releases the tracked shared material exactly once and removes all window listeners. This is observed resource lifecycle stability, not a full JS heap or VRAM leak proof.

Browser start/end counts were 39/39 rigid bodies and 557/557 colliders (the whole scene, including demo/character/environment objects). Vehicle geometry/material UUIDs remained unchanged. One final view reported 80 GPU geometries, two textures, 31 draw calls and 32,346 triangles. That is a view-dependent sample, not a matched-view cross-commit performance comparison or a full memory profile. The final app chunk is 145.11 kB minified / 50.71 kB gzip. No hardware FPS claim is made.

## 10. Required checks

| Command | Result |
|---|---|
| `bun run lint` | PASS; no remaining diagnostics; automatic-fix scope reviewed |
| `bun run typecheck` | PASS |
| `bun run build` | PASS |
| `bun run verify:all` | PASS — 831 PASS cases/groups |
| `git diff --check` | PASS |

The original 743 PASS cases/groups are preserved. Two appended scripts add 11 endurance groups and 77 mounted stabilization checks. PASS labels include grouped scenarios rather than uniformly isolated unit tests.

Existing build warning remains: Rapier's 2058.37 kB minified chunk exceeds the configured 1600 kB warning threshold. No unrelated bundle/dependency refactor.

## 11. Browser scope

27 assertions passed in the final Chromium WebGL run using SwiftShader, with no JavaScript or shader errors. See `phase34/browser-results.json` for exact assertions, durations, resource samples and six screenshots. Tests use real keyboard controls and actual Rapier/camera/HUD components.

Each car completed three driving sequences totaling 27.6, 27.57 and 27.57 simulated seconds respectively, with repeated W/S/Space input on existing roads. Checks include finite/upright physics and chase state, original-spawn E selection/name, blur reset, partial R cancellation, full R recovery, safe exit/walking restoration, and retained asset/body counts. The pickup's actual loading-dock test used real mouse drag and scroll, verified projected focus remained on screen and the camera sphere did not intersect static geometry. F/P/C, Shift+T, nighttime pickup brake/reverse activation and lamp reset were also exercised.

An initial browser pass was interrupted when final review identified a cleanup dependency that needed to remain stable across Physics debug context updates. The final source and browser run include that correction; the mounted regression explicitly tests active driving through a P context update.

Original-spawn selection uses pedestrian approach fixtures. Sustained road fixtures reposition the occupied car onto separate existing road centrelines, preserving the production layout. Rollovers are injected for recovery verification. These are controlled tests, not an uninterrupted owner playthrough or manual acceptance.

## 12. Limitations

Actual GPU FPS, full heap/VRAM profiling and extended subjective driving feel remain manual checks. Tight spaces can still require camera pull-in; the correction specifically addresses stale aim after relocation, not a camera redesign or universal unobstructed silhouette. Removing a car component is not a gameplay feature; teardown uses safe-space validation rather than forcing a pedestrian into occupied space. Vehicle positions remain session-only, as before.

## 13. Manual acceptance checklist

- Drive all three for extended periods; compare existing feel, steering, braking/reverse and handbrake release at low/high speeds.
- Traverse all main/secondary roads, junction types, parking areas, four driveway cuts and uncut curbs.
- Collide with buildings, garage/showroom, dock, containers, trunks, poles, benches and other parked cars; check bounce, sliding and surface support.
- Repeatedly enter/exit/switch while holding controls; check speed/blocked-exit hints and parked transforms.
- Blur/hide the tab while accelerating/braking/steering; return and verify no stuck controls, phantom E or partial R recovery.
- Check real blockage/recovery, throttle release, partial R cancellation, safe return and other vehicles staying untouched.
- Orbit/zoom at the pickup loading dock and near building corners; check collision pull-in/release, handoffs, recovery and C debug camera.
- Check HUD names/speed, brake lamps (S forward braking, W reverse braking, Space), reverse lamps and reset by day/night.
- Recheck creator/presets/clothing/persistence, walking/sprint/jump/step-up, F/P/C, Shift+T, dynamic sky/lights/windows and physics yard.
- Measure real desktop performance with F and review extended memory behavior on actual GPU hardware.

## 14. Git and stopping point

HEAD remains `11943d5`; local identity unchanged. All Phase 3.4 changes remain unstaged. No commits, pushes, deployments, authentication/configuration changes, secret access or blockchain operations. Phase 4 has not started. Manual acceptance is not claimed.
