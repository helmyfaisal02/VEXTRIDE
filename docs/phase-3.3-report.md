# VEXTRIDE Phase 3.3 — Arcade Driving Polish & Vehicle Recovery

Implemented and locally validated on 2026-11-20. Manual browser acceptance remains pending. No Phase 3.4 work.

## 1. Initial repository inspection

Started from clean `main...origin/main`, HEAD `099b5b6` (`feat: add VEXTRIDE vehicle variety and handling`). Phase 3.2 was committed. Local identity was `helmyfaisal02` / `hijautua39@gmail.com` and remains unchanged.

Inspected Vehicle/VehicleSystem, three definitions/models, fixed-step simulator, runtime registry, safe entry/exit, keyboard routing, VehicleCamera/CameraDirector, HUD, Rapier integration, city/environment colliders and driveway fixtures, day/night material updates, and Phase 3.1/3.2 tests. Baseline `verify:all` passed with 706 PASS cases/groups.

Findings: the existing controller already had fixed 60 Hz physics, CCD, upright constraints, four spherical curb runners, vertical rise limits and sleeping parked bodies. Steering already had a yaw cap but retained its full wheel angle at speed; handbrake grip switched abruptly. Brake lamps were driven directly by S, including reverse acceleration. There was no recovery system or reverse lamp geometry.

## 2. Files created or modified

Modified:

- `src/game/vehicles/vehicleConfig.ts`: configurable steering reduction, throttle ramp, grip response and handbrake tuning.
- `src/game/vehicles/vehicleSim.ts`: shared handling improvements.
- `src/game/vehicles/Vehicle.tsx`: per-car recovery binding and efficient reverse lamps/signal updates.
- `src/game/vehicles/vehicleState.ts`: discrete recovery feedback and per-car camera revision counter.
- `src/game/input/inputState.ts`: held R flag and reset.
- `src/game/input/useKeyboardInput.ts`: route R through the existing listener and guards.
- `src/game/camera/VehicleCamera.tsx`: recovery handoff through the existing camera transition.
- `src/game/hud/VehicleHud.tsx`: contextual recovery hint/success/failure.
- `scripts/verify-input.tsx`: six additional R input checks; existing assertions retained.
- `package.json`: append `verify:driving-polish` to `verify:all`.

Created:

- `src/game/vehicles/vehicleRecovery.ts`: eligibility, safe-pose sampling/validation and recovery.
- `src/game/vehicles/vehicleSignals.ts`: motion-aware brake/reverse signal selection.
- `scripts/verify-driving-polish.ts`: 31 focused real-Rapier/handling/recovery groups.
- This report and `docs/phase33/`: browser results, rendered screenshots and a recorded browser timing limitation.

No dependency, lockfile, city/environment geometry, original vehicle model, VehicleSystem, character, persistence, world-clock, lighting, CameraDirector or Git configuration changes. The existing HUD brand still carries its prior Phase 3.2 label; the normal HUD was otherwise preserved.

## 3. Handling improvements

One shared controller remains responsible for every vehicle. Forward/reverse speed caps, base acceleration/brake strength, masses, dimensions and parked spawns remain unchanged.

| Parameter | Street Coupe | City Sedan | Utility Pickup |
|---|---:|---:|---:|
| Forward cap, m/s | 22 | 18 | 15 |
| Reverse cap, m/s | 7 | 6 | 5 |
| Base acceleration, m/s² | 8 | 6 | 4.5 |
| Foot brake, m/s² | 16 | 14 | 12 |
| Throttle ramp rate, m/s³ | 36 | 26 | 20 |
| Wheel-angle reduction at forward cap | 35% | 40% | 45% |
| Handbrake deceleration, m/s² | 18 | 16 | 14 |
| Maximum handbrake yaw multiplier | 1.18 | 1.08 | 1.02 |
| Grip blend response, per second | 5 | 6 | 7 |

Throttle approaches configured acceleration over a short ramp, preserving the coupe's quick response and pickup's heavier feel. Existing smooth coasting/drag remains. W brakes backward movement before forward acceleration; S brakes forward movement before reverse. Simultaneous W/S now brakes rather than coasting. Steering retains parking authority while reducing angle quadratically with speed and slowing steering response at speed. Existing high-speed yaw limits continue to apply.

## 4. Handbrake

Space takes priority over throttle and applies stronger deceleration than before. Lateral grip blends toward the configured handbrake traction and restores exponentially after release. The coupe has the strongest extra yaw allowance and lowest sliding grip; the pickup retains higher grip and almost no extra yaw. Yaw remains capped and turning vanishes as the car stops. Walking Space jump is unchanged.

This is a lightweight chassis-traction approximation, without independent front/rear tire simulation or a new drift mode.

## 5. Stability and world compatibility

Preserved CCD, actual collision response, upright constraints, four road runners, normal-filtered ground probes and existing grounded upward-velocity limits. Reduced steering at speed and gradual grip restoration avoid abrupt handling changes. No city collider was removed or changed, and ordinary driving still updates physics velocities rather than teleporting meshes.

Original suites retain all 40 road segments, four driveway cuts, existing intersections, uncut curb traversal, actual environment obstacle collisions, vehicle switching, sleeping and pedestrian regression coverage. New tests add braking turns at every driveway cut for all three cars and check ground height/upright stability. Existing environment, road graph, buildings, props and dynamic lighting sources remain unchanged.

## 6. Recovery

Only the occupied vehicle can recover. Eligibility requires either:

- An overturned orientation (`up < 0.35`) settled for at least 0.6 seconds, with limited horizontal/vertical motion; or
- Three seconds of sustained throttle with negligible displacement, horizontal speed below 0.6 m/s and vertical speed below 0.5 m/s.

Confirmed blockage grants a three-second stationary recovery window, so the player can release throttle before holding R. Moving away cancels the window; it also expires. Parking, handbraking, normal driving, walking and free-falling do not create eligibility. Holding R for one second completes an eligible attempt. Releasing R, losing focus or opening the creator cancels the hold through the existing input reset path. OS key repeat cannot re-arm reset input.

The active car samples a volatile last-safe pose at most twice per second while upright and grounded. Recovery prefers that pose, then tries the original configured spawn. Both are revalidated at the moment of recovery:

- World bounds and finite coordinates.
- Static ground support at the center and four wheel positions, sufficiently level normals/heights, and a limited change from the recorded ground elevation.
- Every configured chassis cuboid, enlarged by a 4 cm clearance skin, and every runner sphere.
- Clearance against buildings, props and other cars; sensors/self are excluded.

Successful recovery restores upright yaw, clears linear/angular velocity and handling history, resets held inputs, retains the occupied ID and notifies the chase camera. Other vehicles are untouched. If neither pose is safe, the car is not moved and the HUD says recovery is blocked. Failure also resets input so a held repeat cannot retry continuously.

No location persistence or checkpoint save system was added. The last-safe pose is runtime-only safety data.

## 7. Visual feedback and HUD

Brake lamps brighten for Space, S braking forward movement, or W braking backward movement. S reverse acceleration uses normal red running-lamp brightness. Separate white reverse lamps illuminate during backward travel and turn off when stopped, driving forward or handbraking. Parked cars do not inherit another car's pedal state. Existing headlights and night-dependent running lamps remain emissive; no real lights were added.

Each reverse pair is one merged mesh built once, with an independent per-car material. The original three body models and wheel geometry are unchanged; wheel steering/rolling still follow smoothed steering and resolved movement. Existing vehicle name, speed, handbrake readout and controls remain; only discrete recovery feedback was added.

## 8. Camera

A successful recovery increments the active car's revision. VehicleCamera refreshes its focus and invokes the established 0.9-second camera handoff while retaining damped heading, user orbit/zoom and collision pull-in/release. No replacement camera controller or CameraDirector changes.

Browser sampling observed smooth recovery orientation (pickup sample: maximum adjacent-frame quaternion angle about 0.35 radians over 15 frames). Clear-road nighttime recovery also passed for all three cars. Tight loading-dock handoffs can temporarily obscure the truck/lamps; this remains a manual camera review item, not a claim of perfect framing in every confined location.

## 9. Performance impact

Still three vehicle rigid bodies and 22 vehicle colliders. Parked cars retain sleeping and physical wake-up. No new shadow lights or per-frame geometry reconstruction. Reverse lamps add three small meshes/materials across the fleet: one draw call and 24 triangles per visible vehicle, without extra lamp shadow passes.

Handling/recovery state uses refs/mutable values. React/Zustand receives only changed discrete hints, not hold progress or per-frame physics. Ground/clearance checkpoint sampling runs at 2 Hz for the occupied car; full destination checks occur on eligible recovery attempts. Assets/materials are disposed on unmount.

Final app chunk: 144.65 kB minified / 50.51 kB gzip. Browser validation used SwiftShader software rendering and does not establish hardware FPS or the desktop performance target.

## 10. Required validation

All required commands passed on the final production source:

| Command | Result |
|---|---|
| `bun run lint` | PASS, no remaining diagnostics; automatic-fix changed-file scope reviewed |
| `bun run typecheck` | PASS |
| `bun run build` | PASS |
| `bun run verify:all` | PASS: 743 PASS cases/groups |
| `git diff --check` | PASS |

The previous 706 PASS cases/groups remain passing. Added 31 driving-polish groups and six input checks. Counts are script PASS labels; groups can contain multiple assertions/scenarios.

New real-Rapier coverage includes speed-sensitive steering, acceleration ramp, coasting/braking/reverse, simultaneous pedals, handbrake override/traction restoration/yaw bounds, lateral slip, comparable 60/120 Hz integration, curb-cut braking turns, safe spawn support, overturn detection/hold duration, normal-driving and airborne rejection, actual wall blockage, grace-window expiry/cancellation, dynamic vehicle clearance, spawn fallback, fully blocked recovery, partial-hold cancellation, input reset and lamp states. Existing mounted fleet/player/camera and city/environment tests remain passing.

Existing build warning remains: the Rapier bundle is 2058.37 kB minified, exceeding the configured 1600 kB chunk warning limit. No lint/type errors or dependency changes.

## 11. Browser checks

33 retained assertions passed across focused Chromium/WebGL runs; see `phase33/browser-results.json`. Renderer: ANGLE/Vulkan SwiftShader. No JavaScript or shader errors were recorded in the completed fixtures.

Evidence covers original-spawn vehicle approach/entry, acceleration/cornering, Space overriding W, movement-based wheels, brake/reverse emission, normal R rejection, controlled rollover recovery through actual held R, active ID/input reset, safe pedestrian exit, recovery camera samples, F/P/C and Shift+T, and focus loss. Additional clear-road fixtures captured nighttime brake/reverse appearance and rollover recovery for every model. A temporary test-only Rapier wall verified genuine blockage, releasing W while the hint remains, and completing R recovery without throttle.

Scope and limitations:

- Pedestrians were positioned near actual cars for original-spawn approaches; vehicle actions used real keyboard input.
- Night lighting/recovery fixtures repositioned one tested car at a time onto an existing central road. The wall fixture added one temporary collider only inside the browser test session. Application city geometry is unchanged.
- Rollovers were injected using Rapier rotation because normal upright locks prevent accidental flips. Recovery used the actual R input and production validation path.
- Initial broad attempts timed out while waiting for the brief W-braking flash after reverse. Braking can finish between software-rendered frames; the pickup also reaches its loading dock during a screenshot delay. `browser-attempt-timeout.json/png` retain one failed observation. This transient visual assertion is not claimed as fully verified; all three motion/signal paths pass Rapier tests.
- One dock-adjacent nighttime capture is obstructed during handoff. Separate `*-night-clear.png` screenshots verify lamp appearance without that obstruction.
- These are controlled browser fixtures, not uninterrupted manual city journeys. Mouse orbit/zoom was preserved in code/tests but was not separately exercised by this phase's browser harness.

## 12. Remaining limitations

Manual acceptance and actual GPU FPS measurement are outstanding. Subjective grip/handbrake feel and extended high-speed city runs need owner review. Chassis grip is an arcade approximation; upright locks and simple runners remain, without mechanical suspension. Recovery intentionally fails if both supported, clear destinations are unavailable. Vehicle locations still reset on reload. Build bundle-size warning and confined dock camera framing remain as described above.

## 13. Manual acceptance checklist

- Compare coupe agility, sedan predictability and pickup turning radius on main/secondary streets and four-way/T junctions.
- Check gentle steering near garages/parking, throttle release, stopping/restarting, reverse, simultaneous pedals, and high-speed steering.
- Hold Space with W and while cornering; confirm controlled deceleration/sliding, smooth grip restoration and stable stopping.
- Cross all Motor Row cuts and low curbs, including braking turns; check collisions with substantial props and other parked cars.
- Press/hold R while driving normally or parked: no recovery. Push against an obstacle for three seconds, release W, and hold R for one second while the hint is available. Verify safe return, input reset and retained vehicle/camera.
- Verify recovery orientation with a controlled rollover fixture if needed; do not remove the production upright constraints to test it.
- Check brake lamps under S forward braking, W reverse braking and Space; check white reverse lamps and normal running lamps in daylight and at night.
- Check orbit/zoom, wall collision pull-in/release, tight loading-dock framing, recovery camera blend, C debug mode and pedestrian/vehicle handoffs.
- Exit and walk between all three vehicles; verify retained poses, correct hints, safe capsule placement and blocked exits.
- Recheck character creation/presets/clothing/persistence, walking/sprint/jump/step-up, F/P/C, Shift+T, clock/sky/streetlights/windows, physics yard and hardware FPS.

## 14. Git status and stopping point

HEAD remains `099b5b6` on `main`; local identity unchanged. Ten tracked files are modified, with new recovery/signals/test modules, this report and browser artifacts untracked. Nothing is staged. No Git configuration/authentication changes, token/private-key access, commits, pushes, deployment or blockchain operations. The user retains all Git operations. Work stops after Phase 3.3; manual acceptance is not claimed.
