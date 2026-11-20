# VEXTRIDE Phase 3.2 — Vehicle Variety & Arcade Handling

Implementation and automated validation complete. Manual acceptance remains pending. Work stops at Phase 3.2.

## 1. Initial inspection

Started from a clean `main` tracking `origin/main`, HEAD `c16adec` (`feat: add VEXTRIDE arcade vehicle foundation`). Phase 3.1 was committed before editing. Inspected the vehicle model/configuration, fixed-step simulator, input routing, interactions, state, cameras, HUD, world integration, city/environment placements and existing regression harnesses.

The existing foundation already provided CCD, upright chassis, four spherical road runners, static ground probes, velocity-driven arcade control, safe capsule exits and camera handoff. These are extended rather than replaced. Original `coupeGeometry.ts`, character controller, keyboard listeners, city geometry/colliders, driveways and day/night implementation remain unchanged.

## 2. Files

Modified:

- `package.json`: append two regression commands to `verify:all`.
- `src/game/vehicles/vehicleConfig.ts`: three definitions, explicit dimensions/handling/camera/spawns and wheel placement helper.
- `src/game/vehicles/vehicleSim.ts`: definition-driven shared controller and parked sleeping.
- `src/game/vehicles/vehicleState.ts`: per-ID body/runtime registry and active vehicle selection; compatibility accessors preserve existing consumers.
- `src/game/vehicles/vehicleInteraction.ts`: nearest valid selection and definition-aware entry/exit.
- `src/game/vehicles/StreetCoupe.tsx`: compatibility wrapper around the shared system for existing single-coupe integrations/tests.
- `src/game/vehicles/index.ts`: shared system export.
- `src/game/camera/VehicleCamera.tsx`: active target and definition-specific framing.
- `src/game/hud/VehicleHud.tsx`: active vehicle name.
- `src/game/hud/Hud.tsx`: Phase 3.2 label.
- `src/game/world/World.tsx`: mount the three-vehicle system.

Created:

- `src/game/vehicles/Vehicle.tsx`: shared model renderer, rigid body, wheel animation and simulator binding.
- `src/game/vehicles/VehicleSystem.tsx`: fleet, shared materials and single interaction coordinator.
- `src/game/vehicles/modelPrimitives.ts`: procedural modeling/material helpers.
- `src/game/vehicles/sedanGeometry.ts`: original four-door sedan.
- `src/game/vehicles/pickupGeometry.ts`: original open-bed pickup.
- `scripts/vehicle-fleet-fixture.ts`: actual Rapier/environment test fixture.
- `scripts/verify-vehicle-variety.ts`: definitions, physics, environment and interaction regression coverage.
- `scripts/verify-vehicle-fleet.tsx`: mounted React/Rapier/player/camera integration coverage.
- This report and `docs/phase32/`: browser result JSON and eleven rendered screenshots.

No dependencies, lockfile, Git settings, environment files or original regression tests were changed.

## 3. Models and handling

Dimensions are length × width × height in meters; speeds are meters/second. Acceleration and braking are configured meters/second².

| Vehicle | Dimensions | Mass kg | Forward / reverse | Acceleration / brake | Steering response | Identity |
|---|---|---:|---:|---:|---:|---|
| Street Coupe | 4.2 × 1.8 × 1.4 | 1130 | 22 / 7 | 8 / 16 | 9 | Original model and active tuning preserved |
| City Sedan | 4.6 × 1.85 × 1.5 | 1450 | 18 / 6 | 6 / 14 | 6.5 | Longer four-door roofline, blue-gray body, stable traction |
| Utility Pickup | 5.1 × 2.0 × 1.8 | 1950 | 15 / 5 | 4.5 / 12 | 4.5 | Taller ochre cab, grille, open cargo bed, wider turns |

All models have front/rear lamps, glass, trim and four independently animated wheels. Sedan door seams and two handles per side distinguish the four-door body. Pickup cargo rails, floor and tailgate preserve an open bed visually and physically. No external models or manufacturer branding.

## 4. Shared physics

One dynamic Rapier body per car; one shared fixed-60-Hz controller. All retain gravity, CCD, upright rotation constraints, road runners, ground contact probes, braking/reverse, handbrake, speed limits, lateral traction and high-speed steering reduction. Vehicle definitions supply dimensions, collider masses and handling constants. Wheel roll follows resolved chassis displacement; front steering follows the smoothed steering state.

Only the occupied ID receives driving input. Other cars remain solid and brake to rest, then sleep; physical impacts can wake them. Three bodies replace one. Vehicle colliders increase from 6 to 22: coupe 6, sedan 6, pickup 10. Pickup uses separate bed floor/rails/gate instead of a solid invisible cargo box. City and environment collider counts/geometry are unchanged.

## 5. Deterministic spawns

| Vehicle | Position x,y,z | Heading | Existing placement |
|---|---|---|---|
| Coupe | 106.4, 0.55, -144 | South | Original Motor Row north parking stall |
| Sedan | 140, 0.60, -15 | North | Motor Row south commercial parking, near Daybreak Mart |
| Pickup | 13.85, 0.70, 108 | West | Bluecrate Logistics loading apron, building-17 |

Coupe/sedan positions derive from existing `motorParking()` bounds/stall spacing. Pickup apron derives from the existing warehouse footprint/local frame and reserved industrial loading area. No paving, road lanes, sidewalks, buildings or garage entrances were moved. Actual Rapier tests verify spawn clearance against the full existing static environment, and verify pickup departure west over the existing low curb. All three vehicles traverse the existing road-segment and curb-cut fixtures.

## 6. Entry, exit, camera and HUD

One interaction coordinator selects the nearest eligible vehicle within its entry range, checks line of sight (including other vehicles), and shows that vehicle's name. E selects its ID, resets inputs, disables the pedestrian body and activates only that chassis. E exit retains speed gating, ground validation, capsule clearance, vehicle-sized candidate offsets and blocked-exit hints. Safe exit restores the original pedestrian body/controller. Vehicle poses are retained when switching.

The existing chase camera reads the active runtime and adjusts distance, focus height and pitch per definition. Existing orbit/zoom, collision, CameraDirector handoff, creator and C debug modes remain in place. Vehicle HUD displays active name, speed and existing control/mode hints. Clock, F/P/C and Shift+T remain available.

## 7. Performance

Geometry is built once per mounted model, with merged material groups and wheel geometry reuse. Four common body/glass/trim/tire materials are shared across the fleet; head/tail emissive materials remain independent for braking. No added real-time lights. No per-frame React state updates or geometry reconstruction. Runtime animation/camera data uses mutable objects. Parked bodies sleep.

The browser used ANGLE/SwiftShader software rendering. A single F-overlay sample was **6 FPS, 155.8 ms, 28 calls, 25.0k triangles** in that view. This is not a hardware benchmark or proof of the desktop FPS target.

## 8. Automated validation

All required commands completed successfully:

| Command | Result |
|---|---|
| `bun run lint` | PASS, including the repository's automatic fixes; final changed-file scope reviewed |
| `bun run typecheck` | PASS |
| `bun run build` | PASS; 10.46 seconds |
| `bun run verify:all` | PASS; 706 PASS cases/groups across the repository scripts |
| `git diff --check` | PASS |

The previous 640 cases/groups remain passing, including unchanged Phase 3.1 single-coupe tests. New coverage adds 34 variety/physics groups and 32 mounted fleet checks. Group counts reflect the scripts' PASS labels, not 706 separately isolated physics scenarios.

Coverage includes three definitions/IDs, dimensions/collider mass, actual environment spawn clearance, distinct acceleration and turn radii, braking/handbrake/reverse/speed caps, upright stability, sleeping and impact wake-up, actual garage/container collisions, all 40 roads and four driveway cuts per vehicle, open pickup bed collision, pickup apron departure, nearest selection, sequential enter/exit, safe exits, independent transforms, active camera/HUD target, wheel movement, independent braking lamps and pedestrian restoration. Applicable tests use real Rapier worlds; mounted tests use the original Player and CameraDirector.

Build warning: the existing Rapier bundle exceeds the 1600 kB chunk warning limit (2058.37 kB minified, 761.62 kB gzip). No type/lint errors remain. No dependency changes were made to address this existing bundling warning.

## 9. Chromium/WebGL validation

44 checks passed in a real headless Chromium WebGL scene. `phase32/browser-results.json` records checks, errors, speed samples, renderer and test scope. Actual screenshots show each vehicle at its original spawn in daylight and nighttime, each occupied HUD/chase view, the open bed, and pickup nighttime driving.

Browser actions exercised real keyboard walking approaches and E entry/exit for each car, W acceleration, A steering, S braking/reverse, Space handbrake, moving-exit rejection, wheel direction, pedestrian restoration, independent parked poses, active HUD names, pickup mouse camera orbit/zoom, C/P/F and Shift+T. All three objects remained present after switching. No JavaScript or shader errors were reported.

Test fixtures repositioned the pedestrian near each original parking location to avoid long software-rendered journeys; the subsequent approach and vehicle actions used actual input. Vehicles were not teleported for browser selection. Mounted integration tests additionally walk between three test positions. These checks do not establish an uninterrupted manual journey across the city or manual acceptance.

## 10. Limitations and manual acceptance

Vehicle positions are session runtime state and return to configured spawns on reload; character/time persistence is unchanged. Upright arcade bodies and simple ground probes remain intentionally lightweight, without mechanical suspension or damage. Lamps are emissive rather than new projected light sources. Browser checks were short controlled drives; extended high-speed city handling and subjective camera feel still require manual review.

Manual checklist:

- Walk from Central Plaza to Motor Row; enter the original coupe, drive out through the existing north driveway, and check its previous feel.
- Find the sedan in the south commercial parking pad, maneuver through existing access, and compare its calmer cornering/braking.
- Find the pickup by Bluecrate Logistics; leave/return to its loading apron and check its wider turning radius.
- Drive each on main/secondary streets, four-way/T junctions and all driveway cuts; test sustained speed, braking, reverse and handbrake.
- Park, exit, walk to another vehicle, and return; verify parked poses, collision and hints.
- Try walls, containers, another parked vehicle, confined exits and moving exit rejection; confirm no clipping or unsafe pedestrian placement.
- Review chase collision beside buildings, zoom/orbit, entry/exit transitions and C debug mode for each model.
- Review silhouettes, wheel steering/rolling and lamps by day and night; use Shift+T and confirm clock, streetlights/windows and HUD persist.
- Recheck Character Creator, presets/clothing, guest persistence, walking/sprint/jump, F/P/C, physics yard and camera transitions.
- Measure sustained FPS on actual desktop GPU hardware with F; do not infer performance from SwiftShader.

## 11. Git safety

Local identity verified unchanged: `helmyfaisal02` / `hijautua39@gmail.com`. HEAD remains `c16adec`. All Phase 3.2 files are unstaged modifications or untracked additions. No staging, commits, push, deployment, Git/authentication configuration changes, token access or blockchain actions were performed. User review and manual Git operations remain outstanding. No Phase 3.3 work.
