# VEXTRIDE Phase 3.1 — Arcade Vehicle Foundation

Implemented locally. **Ready for review and manual acceptance; Phase 3.1 is not reported as manually accepted.** Stopped before Phase 3.2. No staging, commit, push, deployment, authentication changes, or blockchain operations were performed.

1. **Initial project inspection**

   Phase 2.4 was safely committed as `9e0441f` (`feat: finalize VEXTRIDE city environment`), on a clean `main` tracking `origin/main`. Local identity matched the requested name/email. `src/game/vehicles/index.ts` was only a placeholder; there was no partial vehicle implementation to overwrite.

   The existing app uses React/R3F, a fixed 60 Hz Rapier simulation, mutable input snapshots and player state, Zustand for discrete UI state, and CameraDirector for camera ownership. Motor Row parking dimensions and Phase 2.4 entrance metadata were available for deterministic spawning. Baseline lint, TypeScript and all 599 previous PASS cases/groups passed.

2. **Files created or modified**

   Modified:

   - `package.json`: append two vehicle verification commands to `verify:all`.
   - `src/game/vehicles/index.ts`: export the prototype vehicle component.
   - `src/game/world/World.tsx`: mount one Street Coupe inside the existing physics world.
   - `src/game/input/inputState.ts`: shared E held/edge queue, cleared with all other inputs.
   - `src/game/input/useKeyboardInput.ts`: handle E in the original listener; prevent OS repeat from reviving reset input.
   - `src/game/character/Player.tsx`: hide the pedestrian visual while seated.
   - `src/game/character/useCharacterController.ts`: register the body, suspend walking while seated, restore clean character simulation after exit, publish the vehicle position to player-following world systems.
   - `src/game/camera/CameraDirector.tsx`: select the vehicle camera while retaining creator and debug precedence.
   - `src/game/hud/Hud.tsx`: driving/walking control labels, vehicle HUD, current phase label and exit-before-edit rule.

   Created:

   - `src/game/vehicles/vehicleConfig.ts`: dimensions, tuning, spawn and collider configuration.
   - `src/game/vehicles/vehicleState.ts`: discrete Zustand mode/hints plus mutable runtime state.
   - `src/game/vehicles/vehicleSim.ts`: fixed-step driving and resolved wheel travel.
   - `src/game/vehicles/vehicleInteraction.ts`: entry, speed gating, real ground/capsule exit checks and hints.
   - `src/game/vehicles/coupeGeometry.ts`: original procedural model and shared assets.
   - `src/game/vehicles/StreetCoupe.tsx`: rigid body, colliders, controller and wheel/material updates.
   - `src/game/camera/VehicleCamera.tsx`: chase camera using the existing camera utilities.
   - `src/game/hud/VehicleHud.tsx`: speed, mode, controls and contextual interaction hints.
   - `scripts/verify-vehicle.ts` and `scripts/verify-vehicle-integration.tsx`.
   - This report and `docs/phase31/` browser screenshots/results.

   No dependencies or lockfile changes. City geometry, building/prop placement, road graph, environment colliders, lighting/time modules, character presets/persistence, existing test files, `.gitignore` and environment files were not changed.

3. **Vehicle model and dimensions**

   One original fictional **VEXTRIDE Street Coupe**, approximately **4.2 × 1.8 × 1.4 m**. The procedural model has a shaped nose, hood, fenders and wheel openings, door/rocker sections, a raked glazed cabin, roof, trunk, handles, mirrors, grille, unbranded plate, headlights and taillights. There are no downloaded models or manufacturer assets.

   Four wheel groups contain separate steering and rolling transforms, with visible tire/spoke geometry. Geometry/materials are shared and created once. The complete vehicle draws approximately 622 triangles across 13 base mesh draw calls before shadow passes.

   [Day model](phase31/coupe-model-day.png) · [Night model](phase31/coupe-model-night.png).

4. **Vehicle physics architecture**

   One dynamic Rapier body with CCD, two chassis/cabin cuboids and four spherical ground-contact runners. Total configured collider mass is 1,130 kg. Wheels are visual transforms rather than separate mechanical bodies. X/Z rotation is locked to keep the arcade chassis upright; yaw remains dynamic.

   The controller runs before each existing fixed 1/60-second physics step. It changes linear/angular velocities while Rapier resolves gravity, road contacts and obstacle collisions. Ordinary driving never teleports the vehicle pose. Four reusable downward probes determine static ground contact. Longitudinal acceleration/braking, exponential lateral traction and a speed-dependent yaw limit provide arcade handling. Grounded upward speed is limited to 1.2 m/s before the solver to reduce curb launches; airborne motion retains gravity.

   Initial tuning: forward cap 22 m/s (79.2 km/h), reverse cap 7 m/s (25.2 km/h), forward acceleration 8 m/s², reverse acceleration 5 m/s², active braking 16 m/s², and stronger handbrake deceleration than coasting. Passive drag increases modestly with speed. Vehicle friction uses the minimum combine rule so high-friction sidewalks do not overwhelm the controlled traction model. City friction/collisions were not weakened.

5. **Driving controls and input routing**

   | Input | Walking | Driving |
   | --- | --- | --- |
   | W | Existing forward movement | Accelerate; brake reverse motion before moving forward |
   | S | Existing backward movement | Brake forward motion, then reverse |
   | A / D | Existing lateral movement | Steer left/right relative to the car |
   | Shift | Sprint | No driving action |
   | Space | Jump | Handbrake |
   | E | Enter nearby parked coupe | Request a safe exit |

   The original keyboard listener owns all movement keys and E; no competing vehicle listener was added. Mode changes clear held keys, jump/E queues and steering input. OS repeat cannot reactivate keys after a mode/menu/focus reset; a fresh press is required. Ctrl/Alt+E are ignored. Existing blur, visibility and creator guards remain in use. Developer time controls continue to capture their own input and reset held keys.

6. **Entry and exit**

   Spawn: existing northern Motor Row parking pad, approximately **X 106.4, Z −144**, facing south toward its aisle. This uses the existing stall spacing/pad dimensions and does not occupy a Phase 2.4 entrance. Spawn clearance was tested against the actual environment.

   Within 3 m of the car center, with a clear static line of sight and low vehicle speed, the HUD offers E to enter. Entry disables the pedestrian rigid body/colliders, hides the model and clears input. The body does not interfere with the car. Interpolated vehicle position is published to `playerState` for the existing shadow/streetlight/debug-camera consumers while seated.

   Exit requires horizontal speed at or below 1 m/s. Candidate locations beside the doors and at the front/rear are rotated with the chassis. Each must have an upward-facing real ground hit, a reasonable height difference, a clear route out and room for the original pedestrian capsule, including clearance from the car. Actual world ground is queried, including the existing demo-yard ground; no guessed road height is used.

   If blocked, the player remains seated and receives an exit-blocked hint. A moving-exit request displays a brake hint, which clears when stopped. Successful exit places the original body slightly above valid ground, re-enables it, resets character simulation/input and restores walking. The car retains its position/orientation and receives parking deceleration. No door animation/interior was added.

7. **Chase camera**

   A dedicated vehicle-relative chase camera uses a damped heading, slightly elevated view, modest speed-dependent distance/look-ahead, mouse orbit and scroll zoom. It reuses `cameraClearance`, `stepCameraDistance`, `poseCamera` and the existing hand-over timing. Both the desired placement and final blended pose are constrained against static geometry.

   CameraDirector still mounts exactly one system: creator preview takes precedence, C debug orbit overrides the chase view, and exiting returns to the pedestrian follow camera. The character camera, creator camera, orbit controller and transition utility implementations were not replaced.

   A targeted real-browser check used live Rapier bodies and found zero static-volume intersections across 20 rendered camera samples beside the garage wall. Actual mouse drag and scroll changed the chase camera parameters. [Camera results](phase31/camera-results.json) · [Near-wall view](phase31/chase-camera-wall.png).

8. **HUD integration**

   Driving shows vehicle name, speed in km/h, N/D/R or handbrake state, and concise controls. Walking near the coupe shows E to enter. The original world-time HUD, performance/collider shortcuts and character name remain visible. Character editing requires exiting first; the disabled edit button explains that rule in its tooltip.

   Speed readout updates through the existing performance publication cadence, without per-frame React state. React receives only mode and contextual-hint changes.

9. **Collision and world compatibility**

   Real Rapier tests cover all 40 existing road segments in their existing right-hand lanes, left turns through a four-way and a T-junction, all four Phase 2.4 curb cuts, a normal uncut 0.13 m curb, the actual garage facade and a substantial container using existing dimensions. Tests verify collision stops the car instead of letting it pass through objects, and that wheel travel stops while pushing against a wall.

   The entire city/environment/lighting source remains unchanged. All six districts, 20 buildings, 413 props, 444 environment colliders, 57 city colliders and the navigation graph remain intact. The only new physics cost is the coupe's one body/six colliders. Existing tests still verify roads, crosswalks, spawn, step-up, slopes, demo-yard objects, character behavior and dynamic lighting.

10. **Performance**

    Geometry/materials are built once and disposed on unmount. Wheel, light-emission and camera changes mutate reusable objects. Physics runs at the established fixed step and state shared with the HUD avoids frame-by-frame React updates. No suspension joints, wheel rigid bodies, projected headlights or additional real-time lights were introduced.

    The browser used ANGLE/SwiftShader software rendering at 1280 × 800. One view-dependent overlay sample measured **9 FPS, 109.7 ms, 23 calls, 11.0k triangles**. That view faced relatively little city geometry; it is not a representative city benchmark, a comparison against earlier phases, or proof of the 30 FPS hardware target.

11. **Automated results**

    | Command | Result |
    | --- | --- |
    | `bun run lint` | PASS, no warnings/errors |
    | `bun run typecheck` | PASS |
    | `bun run build` | PASS; existing large Rapier chunk warning |
    | `bun run verify:all` | PASS: 640 PASS cases/groups, including all 599 previous cases/groups |
    | `git diff --check` | PASS |

    Added 22 vehicle groups and 19 mounted integration checks. Coverage includes model geometry, valid spawn, acceleration/coasting/braking/handbrake, reverse, steering, speed caps, upright/curb behavior, actual wheel displacement, parked input gating, render-frame grouping at 30/60/144 FPS, real world collision/traversal, safe/blocked exits, LOS, input resets/repeat/focus loss, camera ownership, mounted body/visual switching and restored walking.

    The integration test mounts the real StreetCoupe, Player, CityColliders, EnvColliders and CameraDirector in a real Rapier world. Existing tests were neither excluded nor rewritten.

12. **Browser tests performed**

    The primary Chromium/WebGL smoke passed 22 checks: visible coupe/four wheels, actual walking approach, E entry, disabled pedestrian physics, driving HUD, edit gating, acceleration/wheel motion, steering, moving-exit blocking, S braking, Space handbrake, reverse, existing-street driving, a controlled-speed central intersection turn, north parking curb crossing, nighttime emission, Shift+T, C/F/P, safe exit, parked pose retention, restored walking and no observed JavaScript/shader errors.

    Test setup repositioned actual Rapier bodies at parking/street/junction/crossing fixtures; actual approach, interactions and driving used keyboard input. This does not prove an uninterrupted journey from Central Plaza through the whole city. The full-throttle initial automated turn ran wide over a curb; the grounded rise limit was added and tested, and the junction was retested with controlled low-speed input. Tight turns still require braking.

    The supplemental camera harness initially failed to obtain development-module runtime references. A live-scene version located the actual Rapier bodies and passed the near-wall/drag/zoom checks. Those setup failures are not counted as passed checks. Initial smoke also observed a missing-resource 404; it did not prevent rendering.

    Evidence: [main browser results](phase31/browser-results.json), [walking approach](phase31/walking-to-coupe.png), [entered chase view](phase31/entered-chase.png), [street driving](phase31/street-driving.png), [reverse](phase31/reverse.png), [curb crossing](phase31/curb-cut.png), [night driving](phase31/night-driving.png), [walking after exit](phase31/exited-walking.png).

13. **Known limitations**

    This is one session-local prototype, not vehicle ownership. Refresh restores its designated parking spawn. Vehicle position/orientation persist across entry/exit within the running session; character/time persistence remains separate and unchanged.

    The chassis stays upright and wheels have no mechanical suspension or independent contact simulation. Headlights/taillights emit visually but do not project light beams. There are no interiors, damage, door animations, traffic, NPCs, purchases or additional variants. High speed requires braking before tight intersections. Fully constrained camera angles may require close framing.

    Hardware performance, long unassisted driving, every camera angle/obstacle approach, and the full manual checklist remain unaccepted. Automated and WebGL checks do not constitute manual acceptance.

14. **Manual acceptance checklist**

    Run `bun run dev`. The coupe is in Motor Row's north parking pad, behind the garage/showroom, facing its aisle.

    - [ ] Walk/sprint from Central Plaza to Motor Row; approach the car from several sides and confirm the E hint/range.
    - [ ] Enter and verify the pedestrian disappears without pushing or destabilizing the car; controls/camera switch smoothly.
    - [ ] Accelerate and release W; assess acceleration, natural coasting, traction, steering and speed cap.
    - [ ] Brake with S, continue into reverse, then move forward again. Check wheel rolling direction and front steering.
    - [ ] Test Space handbrake, low-speed turns and both four-way/T-junctions; brake for tight corners.
    - [ ] Drive all Motor Row curb cuts and along both road classes; inspect ground contact, curb bounce and collision with major props/walls.
    - [ ] Rotate/zoom the chase view near buildings; assess clipping, framing, shake and high-speed visibility.
    - [ ] Try E while moving and with blocked doors/escape routes; verify clear hints and safe behavior. Exit on roads, parking pavement and near a curb.
    - [ ] Resume walking/sprinting/jumping, then re-enter; verify parked pose retention and no stuck keys or unexpected jump after holding Space/E.
    - [ ] Check character creator, all presets/colors and persistence while walking; verify edit gating while driving.
    - [ ] Test focus/tab loss, held-key resets, C/F/P, Shift+T, day/night transitions, streetlights and nighttime windows.
    - [ ] Drive an uninterrupted route and measure FPS on the intended desktop GPU.

15. **Git status and scope**

    `main` still points to the committed Phase 2.4 baseline; history and `.gitignore` were preserved. Local identity remained `helmyfaisal02` / `hijautua39@gmail.com`. All Phase 3.1 changes are unstaged. No Git identity/authentication changes, staging, commits, pushes, deployments, token/private-key access or blockchain transactions were performed. Phase 3.2 was not started.
