# Phase 5.1 — Garage Hub & Vehicle Parking Foundation

## 1. Initial repository inspection

Started on clean `main`, tracking `origin/main`, at `d731d32` (`feat: complete VEXTRIDE phase 4 missions`). Local identity verified as `helmyfaisal02 <hijautua39@gmail.com>`. Read AGENTS.md and inspected actual garage/parking/driveway data, environmental colliders, vehicle definitions/runtime/entry/exit/recovery, shared E coordinator, keyboard/controller/camera systems, NPCs, missions, HUD and regression infrastructure. Baseline `bun run verify:all` passed **992 cases/groups**, exit 0, before editing.

The existing garage is a solid closed building, footprint X 89–113 / Z -112–-94. Its doors and colliders remain unchanged. Existing north parking pavement is X 90–148.5 / Z -147.5–-119.5, with its existing curb-cut entry centered at X 114.

## 2. Files

Created:
- `src/game/garage/garageConfig.ts`: fixed terminal and two bay definitions derived from existing placement data.
- `src/game/garage/garageState.ts`: UI state, terminal reference and derived occupancy only.
- `src/game/garage/garageInteraction.ts`: actual Rapier range/height/visibility checks.
- `src/game/garage/parkingDetector.ts`: observed drive-in and stationary parking validation.
- `src/game/garage/garageGeometry.ts`: compact kiosk and merged corner markers.
- `src/game/garage/garageCatalog.ts`: specifications read from the existing vehicle definitions.
- `src/game/garage/GarageSystem.tsx`: rendering, one fixed collider, detector and lifecycle.
- `src/game/hud/GaragePanel.tsx`: vehicle overview and bay status.
- `scripts/verify-garage.ts`: 11 focused real-city/Rapier groups.
- This report and evidence in `docs/phase51/`.

Modified:
- `src/game/interactions/interactionCoordinator.ts`: include the terminal in nearest walking-target selection.
- `src/game/input/useKeyboardInput.ts`: garage modal/Escape priority in the existing listener.
- `src/game/character/useCharacterController.ts`: reuse existing dialogue movement lock while garage is open.
- `src/game/world/World.tsx`: mount GarageSystem.
- `src/game/hud/Hud.tsx`: mount GaragePanel.
- `scripts/verify-mission-integration.tsx`: preserve both mission workflows and extend garage integration/resource tests.
- `package.json`: append garage verification to the full suite.

No dependencies, lockfile, persistence, vehicle handling, camera implementation, NPC definitions, mission implementation, traffic route, road graph, existing building or prop placement changes.

## 3. Exterior terminal

Terminal center: **X 109.5 / Y 0.03 / Z -92.5**, facing the public forecourt. Dimensions: **0.70 × 0.45 m footprint, 1.60 m tall**. Interaction radius: **2.7 m**.

It is in front of the garage, outside the closed building and the driveway opening, approximately 18.6 m from Marcus. Actual environment data and Rapier checks verify support, clearance and an unobstructed pedestrian approach. Its procedural screen uses a geometric G emblem and an unlit material, with no font download, texture or projected light. One compact fixed cuboid represents the terminal. Garage access remains exterior only.

## 4. Two parking bays

| Bay | Center X, Z | Ground Y | Width × Length | Orientation |
| --- | --- | --- | --- | --- |
| Bay 1 | 120.4, -144.0 | 0.03 | 2.8 × 5.8 m | North/south |
| Bay 2 | 126.0, -144.0 | 0.03 | 2.8 × 5.8 m | North/south |

These are two separated existing marked north-row stalls, with an unused stall between them. The detector envelope extends slightly beyond the old five-meter paint strokes to fit the Pickup's actual 5.1 m length, entirely on existing pavement. Teal corner brackets identify the usable envelopes. No pavement or access geometry is rebuilt.

Validation checks actual paving, building/prop clearance, driveway exclusion, all three vehicle footprints, real approach motion and safe exit. Access uses the existing north-parking curb cut and paved aisle. Neither bay intersects a lane, sidewalk, Marcus, terminal, original parked Coupe or garage entrance.

## 5. Interaction architecture

The existing E coordinator makes one nearest-target decision across vehicles, NPCs and the terminal. Existing targets win exact distance ties. Driving E retains vehicle exit priority; Creator and active dialogue take precedence; an open garage consumes gameplay input. Range/elevation and a Rapier occlusion ray validate terminal interaction. No parallel keyboard listener was added.

Open/close resets held inputs. The player remains grounded with horizontal motion locked through the existing dialogue-style controller path. Escape uses the shared keyboard handler. UI buttons have local focus trapping/restoration. The garage does not change camera mode or vehicle ownership/control.

## 6. Three-vehicle overview

The panel maps the existing three definitions and live registry:

| Vehicle | Length × Width × Height | Top-speed specification |
| --- | --- | --- |
| Street Coupe | 4.20 × 1.80 × 1.40 m | 79 km/h (22 m/s) |
| City Sedan | 4.60 × 1.85 × 1.50 m | 65 km/h (18 m/s) |
| Utility Pickup | 5.10 × 2.00 × 1.80 m | 54 km/h (15 m/s) |

Specifications display rounded km/h. Each selection shows its existing handling identity and derived parking status. Labels are neutral: Available in City / Elsewhere / Parked at Garage. There are no ownership labels, economy actions, spawning, storage, repair or relocation controls.

## 7. Actual parking detection

The detector observes the existing registry's real Rapier bodies at 10 Hz. It does not write vehicle transforms or maintain a second authoritative position registry. Previous pose samples exist only to validate motion.

A car must drive into full bay-footprint containment while occupied, then stop and be exited. All four oriented footprint corners must fit with clearance; north/south alignment, upright attitude and road-level height are required. Speed and angular/vertical motion must remain below thresholds, actual support and chassis-clearance queries must pass, and the car must remain unoccupied/stationary for one second.

Each bay has at most one assignment. Only discrete occupancy changes notify Zustand/React. Entering the car again, moving, losing clearance, leaving the bay, changing recovery revision or removing its body clears parking. Recovery/remount inside a bay cannot confirm parking: the car must leave and legitimately drive back in. Ambient bodies are never eligible because the detector only iterates the three existing player-vehicle registry entries.

## 8. UI and input

Compact dark panel, three selection buttons, actual specifications, current bay status/count and parking instructions. Close, Escape, initial focus, forward/reverse Tab looping and normal movement restoration are tested. Mobile uses a scrollable bounded panel. No expensive preview, additional input architecture, per-frame UI update or camera handoff was introduced.

## 9. Marcus and both missions

Marcus retains his accepted position/model and all original dialogue. The terminal is well outside his interaction radius. The existing First Contact and Shakedown tests remain, now with GarageSystem mounted in the same real Rapier/Player/Vehicle/NPC/Ambient/Camera fixture. Garage opening does not acknowledge dialogue, and parking does not mutate mission progress or checkpoint logic. Both mission histories remain completed after parking, switching, departure and recovery checks.

## 10. Physics, performance and cleanup

Added **one fixed body / one collider**; measured full-scene counts are **47 bodies / 565 colliders**, with the same three playable vehicles and five ambient agents. No dynamic garage bodies, bay sensors, extra lights, per-frame geometry builds or global physics scans.

Three merged geometries/materials render terminal shell, screen and bay brackets: **268 source triangles** (96 shell, 12 screen, 160 markers), nominally three additional mesh draw calls. This is a geometry budget, not a measured full-scene draw-call comparison. Chassis query shapes are cached. Detection is 10 Hz and limited to three vehicles/two bays, with support/clearance queries only for eligible stationary candidates. Three mounted unmount/remount cycles verify release of all six geometry/material resources, terminal body/collider, subscriptions/UI state, and stable callbacks/listeners after remount. No hardware FPS claim is made.

## 11. Automated validation

- `bun run lint`: PASS.
- `bun run typecheck`: PASS.
- `bun run build`: PASS.
- `bun run verify:all`: PASS, exit 0 — **1,023 passing cases/groups** (992 previous + 20 added mounted checks + 11 focused groups).
- `git diff --check`: PASS.

Saved command output: [full suite](phase51/verify-all.log), [lint](phase51/lint.log), [TypeScript](phase51/typecheck.log), [production build](phase51/build.log).

Production app bundle: **184.90 kB minified / 63.28 kB gzip**. The existing large Rapier chunk warning remains.

The first pipe-based full rerun was terminated by SIGTERM (exit 143) during ambient tests without an assertion failure. The attached-terminal rerun completed the entire command with `VERIFY_ALL_EXIT=0`.

The previous 992 cases/groups are preserved. New coverage includes 11 focused garage groups and 20 added mounted integration checks: physical parking for all three cars, safe exits, exclusivity, two simultaneous assignments, independent vehicle transforms, departure, recovery rejection, both missions, keyboard/modal priority and repeated resource cleanup. Applicable tests use real Rapier with actual city/sidewalk/driveway/environment collisions. Fixture setup positions cars outside the bays; the drive-in itself uses the existing controller.

## 12. Browser verification

**Desktop: 25 checks passed.** The complete physical journey created a character and replayed both missions, including explicit acceptance/decline, Marcus/Maya acknowledgements, actual driving through all three Shakedown gates and final completion. It then opened the garage via E, inspected the three neutral vehicle choices, used Close/Escape, re-entered the original Coupe and drove along existing streets and the north curb cut into Bay 2. A low-speed physical alignment/stop and actual E exit confirmed parking. The player walked through the existing side passage to inspect **1 / 2 bays occupied** and **Parked at Garage — Bay 2**, returned to the car, reversed out, exited and revisited the terminal to confirm **0 / 2**. Both completed mission histories remained intact.

No player/car position teleport, velocity forcing or direct mission-state mutation was used for this full journey. The harness adjusted the existing camera yaw and sent normal walking/sprint/driving/E/UI input. No game JavaScript exception or shader error was observed; the existing favicon HTTP 404 is categorized separately. See [desktop results](phase51/browser-results.json), [physical parking](phase51/parked-bay.png), [occupied terminal](phase51/garage-panel-parked.png) and [after departure](phase51/garage-panel-departed.png).

**Mobile: 18 checks passed**, at 375×812. Explicit proximity fixtures position the player near the terminal for UI testing, separate from physical parking proof. Checks include viewport fit, initial focus and Tab/Shift+Tab loop, accurate specifications for all three types, neutral labels, held-key/repeated-E blocking, focus-loss reset, Escape, restored walking, three panel remounts without new global listeners, Creator priority, day/night, F/P/C, fixed body/collider counts and refresh/character persistence. See [mobile results](phase51/mobile-results.json), [panel](phase51/mobile-panel.png) and [night panel](phase51/mobile-night-panel.png).

**Terminal render fixture: two checks passed.** Separate near-terminal player/camera setup verifies the exterior model and E hint by day and night. See [results](phase51/terminal-results.json), [day](phase51/terminal-day.png) and [night](phase51/terminal-night.png). Screenshots were visually inspected.

Chromium used SwiftShader, not a hardware performance measurement. Owner manual acceptance is pending.

## 13. Known limitations

- Session-only parking: refresh recreates original vehicle positions and clears garage occupancy. Existing character persistence remains intact.
- Only the two teal-marked stalls are managed. The garage doors remain closed and solid; no interior access.
- A recovered or remounted car already inside a bay must leave and drive back in before it can count as parked.
- Full physical browser parking uses the Coupe; all three types are covered by real-Rapier drive-in/exit tests.
- Existing large Rapier bundle warning and missing favicon.ico 404 remain. No unrelated branding or deployment helpers were changed.

## 14. Owner manual acceptance checklist

- [ ] Walk to the front-garage kiosk; confirm its placement, E hint and access clear of Marcus/driveway.
- [ ] Open with E, inspect all three definitions and select each; verify no ownership/economy actions.
- [ ] Test Close/Escape, Tab/Shift+Tab, held keys, focus loss and restored walking/camera.
- [ ] Drive each vehicle through the north curb cut into a teal bay, align fully, stop and exit.
- [ ] After a stationary second, inspect the terminal: correct vehicle/bay and occupied count.
- [ ] Park two different cars; verify exclusivity, safe exits and independent positions.
- [ ] Drive one away; verify only its parking status clears.
- [ ] Check partial, moving, sideways and recovered placement cannot spoof parking.
- [ ] Talk normally to Marcus/Maya and play both missions; confirm garage does not steal E or advance objectives.
- [ ] Check day/night, all five ambient agents, cameras and F/P/C/Shift+T.
- [ ] Refresh: original vehicle spawns, empty garage status, saved character unchanged.

## 15. Git safety

Final branch/HEAD remain `main` / `d731d32`; local identity remains `helmyfaisal02 <hijautua39@gmail.com>`. Seven tracked files are modified; nine new source/test files plus this report and evidence are untracked. The index is empty. All Phase 5.1 changes remain unstaged. No Git identity/configuration/authentication changes, staging, commits, pushes, deployments or blockchain actions. Stop after Phase 5.1; Phase 5.2 is not started.
