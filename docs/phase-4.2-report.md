# VEXTRIDE Phase 4.2 — Ambient Traffic & Pedestrian Foundation

Exactly two autonomous traffic cars and three ambient walkers added to the existing city. Manual acceptance remains pending. No Phase 4.3 work.

## 1. Initial repository and architecture inspection

Started from clean `main...origin/main`, HEAD `5563934` (`feat: add VEXTRIDE NPC foundation`). Phase 4.1 was committed. Local identity verified unchanged: `helmyfaisal02` / `hijautua39@gmail.com`.

Read AGENTS.md, actual city lane/navigation structures and legal junction movements, road/sidewalk geometry, full environment placement/collision data, vehicle models/controllers/interactions, NPCs, character models/poses, Rapier setup, World/GameCanvas, cameras, HUD/performance tools and regression harnesses. Baseline `verify:all` passed all 877 existing PASS cases/groups before edits.

The graph provides LaneEdge start/end/direction/from/to data and Movement relationships. Routes below use those exact records. Existing player character, three playable vehicles, named NPC definitions/models/dialogue, input architecture, cameras, HUD, world time/lighting, roads/buildings/props and driveways are unchanged.

## 2. Files

Modified:

- `src/game/world/World.tsx`: mount AmbientSystem alongside the existing systems.
- `package.json`: append `verify:ambient` and `verify:ambient-integration` to `verify:all`.

Created:

- `src/game/ambient/ambientConfig.ts`: fixed population, appearances, speeds and explicit routes.
- `src/game/ambient/ambientRoutes.ts`: graph-derived legal loops, sampled smooth connectors and arc-length sampling.
- `src/game/ambient/ambientSim.ts`: collision-aware fixed-step traffic/pedestrian controllers.
- `src/game/ambient/ambientState.ts`: separate mounted body/traffic/walker runtime registries.
- `src/game/ambient/TrafficCar.tsx`: existing coupe/sedan geometry with independent paint, wheels and emissive lamps.
- `src/game/ambient/AmbientPedestrian.tsx`: existing character models and pose helpers with independent gait state.
- `src/game/ambient/AmbientSystem.tsx`: fixed population and shared traffic material ownership.
- `scripts/ambient-fixture.ts`: real Rapier fixture with actual city/environment collisions, three parked cars and named NPC capsules.
- `scripts/verify-ambient.ts`: routing, sustained simulation, obstacle, pavement and fixed-step scheduling tests.
- `scripts/verify-ambient-integration.tsx`: actual mounted systems, interactions, resource lifecycle and context-update regressions.
- This report and `docs/phase42/`: result JSON and thirteen actual WebGL screenshots.

No dependencies, lockfile, original test scripts, graph, city geometry, vehicle controller/recovery, NPC/dialogue, character preset, input, HUD or camera files changed. The existing HUD Phase 4.1 subtitle remains unchanged.

## 3. Traffic architecture

Two kinematic-position Rapier bodies, one box collider each, sized from the original vehicle definitions. Agent identity/runtime is completely separate from `vehicleRegistry` and `npcRegistry`. Ambient cars cannot be entered, become active HUD/camera targets or receive player input.

Definitions hold ID, model, paint, route, initial distance and desired speed. Runtime keeps route progress, lane/movement ID, pose/forward heading, speed/desired speed, hazard distance, blocked/braking state, steering and movement-derived wheel roll. All updates mutate refs/objects in the existing fixed 60 Hz world. No React/Zustand updates per frame, global input listeners or per-frame pathfinding.

Route construction happens once. Straight sections follow the exact directed lane centerline. Junction connectors resolve only existing legal Movement records and use tangent-continuous quadratic turns, sampled into an arc-length table. The closed loops need no resets or production pose teleports.

## 4. Traffic routes and spawns

Both loops are approximately **330.257 m** and contain four existing lanes/four legal left turns. They are disjoint, avoiding a shared AI junction conflict in this initial population.

| Agent | Model / paint | Directed lanes | Junction loop | Initial chassis position | Clear-road target |
|---|---|---|---|---|---|
| ambient-coupe | Street Coupe / orange `#df7c48` | RZ00:S → RX10:E → RZ10:N → RX00:W | J00 → J01 → J11 → J10 → J00 | (-163.5, 0.53, -137) | 8 m/s |
| ambient-sedan | City Sedan / cream `#e5d6ac` | RZ33:S → RX43:E → RZ43:N → RX33:W | J33 → J34 → J44 → J43 → J33 | (77.75, 0.58, 106.5) | 7 m/s |

Both initially face south, matching their directed lane. Northwest residential and southeast industrial loops use existing right-hand lane offsets. There are no U-turns, graph edits, new roads or shortcuts across lots/sidewalks. Whole-body clearance was checked densely along both routes against the actual city world, including parked cars and named NPCs.

## 5. Traffic movement and safety

Acceleration is limited to 1.6 m/s² and ordinary braking to 3.5 m/s². A forward path scan at 10 Hz considers braking distance, obstacles and upcoming speed limits. Turns reduce the target to 3.2 m/s. Wheel steering is smoothed; roll follows resolved body travel and stops when the car stops. Existing headlights/running taillights follow day/night lighting, with stronger brake emission during slowing/yielding. No projected lights.

Each fixed step performs a full-volume translation sweep plus endpoint overlap and actual road-support checks. The query box includes a 0.4 m horizontal safety allowance, with additional padding enclosing that step's rotation. Only self/sensors are excluded; buildings, props, player bodies, other cars, fixed NPCs and ambient agents can block motion. Validated motion uses `setNextKinematicTranslation/Rotation`; failed checks hold the current body pose. Sudden intrusions can cause an immediate safety stop rather than a smooth ordinary stop.

Following/stand-off uses the first occupied path footprint and approximately two additional meters before that footprint. Real Rapier tests verify stopping, no parked-car displacement and resuming after clearance. The browser also verified the original playable coupe as an obstruction. Agents do not overtake, reverse out, reroute, or teleport to resolve blockage.

## 6. Pedestrian appearances and routes

Three existing original procedural outfit styles are reused with distinct non-default colors. No new named character, dialogue target or mission role.

| Agent | Appearance | Waypoints x,z | Speed |
|---|---|---|---:|
| ambient-plaza | Amber bomber, jeans, short hair | (-58,-22) ↔ (-58,-14) | 1.15 m/s |
| ambient-downtown | Pink hoodie, cargo trousers, beanie | (-45,-86.5) ↔ (-35,-86.5) | 1.25 m/s |
| ambient-residential | Navy utility jacket, chinos, cap | (-151,-68) ↔ (-151,-58) | 1.10 m/s |

The plaza route uses the broad raised plaza. Downtown and residential routes use clear inner portions of actual sidewalk strips. Inspection rejected preliminary corridors containing benches/bins before selecting these coordinates. Full corridor sampling confirms supported pavement, prop/NPC clearance, no road entry and no interference with spawn, Marcus/Maya or vehicle routes. There are no crossings.

## 7. Pedestrian movement, physics and animation

Three kinematic capsules; no new dynamic pedestrians or full player-controller copies. Fixed-step movement follows the short waypoint corridors, pauses at endpoints and rotates at a bounded rate before walking back. A wider capsule sweep, endpoint overlap and ground check reject blocked/unsupported steps. An obstructed walker waits and resumes after the obstruction clears, without pushing ahead or deviating into a road.

Final review reproduced a new-controller endpoint defect: residual speed could briefly move a walker backward during its turn. The fix brakes toward endpoints and holds position throughout the pause/turn. Added per-step regressions require movement to align with facing and endpoint pauses to have no translation.

Existing CharacterModel/rig/groundPose helpers provide walk/idle blending, arm/leg/knee movement, head/torso motion and a gait phase tied to distance. Character appearance data is resolved separately; player presets/settings and named NPC models remain untouched. Feet align with the actual pavement; the collision capsule has a small ground clearance. No animation geometry rebuilding.

## 8. Named NPC and player-vehicle compatibility

Marcus and Maya retain their exact definitions, placements, models, idle animation and three dialogue lines. The single E coordinator is unchanged; ambient IDs are never registered as interactive targets. Mounted and browser tests verify both conversations with ambient motion active.

The Street Coupe, City Sedan and Utility Pickup retain their handling/physics, ownership, cameras/HUD, entry/exit, signals, recovery and cleanup. Added colliders participate in existing safe-exit and recovery queries. Tests verify an ambient car cannot be entered, the original coupe still owns the chase camera, normal exit works, and debug context updates do not reset ambient positions. Browser tests include real player driving/braking near traffic and held-R recovery with the ambient bodies present.

## 9. Performance and lifecycle

Fixed population: **five additional kinematic bodies and five colliders**, no extra dynamic bodies or lights. No distance activation is needed at this population; physics remains deterministic off screen, while normal rendering frustum culling applies. Awareness scans are throttled, but immediate safety checks remain every fixed step.

Traffic shares four common materials and reuses the original procedural model factories and wheel geometry. Walkers reuse existing outfit/animation components. Three removal/remount cycles verified release of all **144 ambient geometry resources and 39 unique materials**, cleared registries and stable body/collider/callback/window-listener counts after remount. Final unmount removes all ambient references and listeners. This is tracked lifecycle evidence, not a full heap/VRAM proof.

Browser counts remained **46 bodies / 564 colliders** throughout verification, versus 41/559 before adding the five agents. A final view reported 266 GPU geometries, two textures, 93 draw calls and 27,514 triangles. Counts are view/warm-up dependent; no matched-view hardware performance comparison or FPS target claim. App chunk: 164.25 kB minified / 56.84 kB gzip.

## 10. Validation

| Command | Result |
|---|---|
| `bun run lint` | PASS, no remaining diagnostics; automatic-fix scope reviewed |
| `bun run typecheck` | PASS |
| `bun run build` | PASS |
| `bun run verify:all` | PASS — 913 PASS cases/groups; whole command exited 0 on final source |
| `git diff --check` | PASS |

Baseline 877 cases/groups are retained. Added 19 real-Rapier ambient groups and 17 mounted integration checks. Groups contain multiple assertions/scenarios rather than uniformly isolated test cases.

New coverage includes exact population/unique separate IDs, graph adjacency/legal directed turns, densely sampled swept-body route clearance, three simulated minutes per traffic profile (two complete loops each), bounded 8/7 m/s speeds and heading changes, wheel movement, fixed/player-car obstacles and resume, two simulated minutes per pedestrian route, pavement bounds, gait/idle/turns, capsule obstacles, identical fixed-step outcomes under synthetic 15/30/60/144 FPS scheduling, NPC/player-vehicle interactions, P-context continuity and remount/resource safety.

Existing build warning remains: the 2058.37 kB minified Rapier chunk exceeds the configured 1600 kB warning threshold. No dependency or unrelated bundling changes. An initial combined run was terminated before the final suite completed; the final validation result requires an explicit successful whole-command exit, not merely the individually passing scripts.

## 11. Browser verification

**23 retained assertions passed** in Chromium/WebGL with SwiftShader; no JavaScript or shader errors. Exact assertions/resource samples are in `phase42/browser-results.json`, with thirteen screenshots.

Observed both naturally moving traffic cars, actual junction turns/front-wheel steering, rolling wheels, three moving/animated walkers, daytime and nighttime appearance, traffic stopping behind the original parked coupe without pushing and resuming after clearance, unchanged Marcus/Maya conversations, player-owned driving/braking near traffic, R recovery, safe exit/camera handoff, F/P/C/Shift+T and stable whole-world body/collider counts.

A focused follow-up verified corrected pedestrian endpoint behavior: facing aligned with actual movement, no translation during the endpoint pause, and smooth walking resumption. Resource samples are from the full-flow browser run; the endpoint follow-up uses the corrected final controller and adds its observations to the same JSON evidence.

Camera views used the existing C debug orbit. Controlled fixtures parked the original unoccupied coupe ahead of traffic and restored its original spawn afterward; later positioned the occupied coupe behind traffic for real driving and recovery tests. Player approach fixtures reached the original named NPCs. These are test-only placements; production ambient movement contains no reset teleport. No manual acceptance or hardware FPS claim.

## 12. Known limitations

- Traffic/pedestrians can legitimately remain blocked indefinitely by parked cars, the player or props. They wait instead of making unsafe escape maneuvers.
- No traffic signals, right-of-way scheduler, overtaking, predictive citywide collision planning, crossings or dynamic detours. The two loops are intentionally disjoint.
- Awareness is reactive and conservative. A player deliberately ramming a stationary/kinematic agent can still cause a normal physical collision; aggressive high-speed player behavior is not guaranteed collision-free.
- The fixed agents restart at configured positions when the system/world is deliberately remounted; no gameplay respawn, schedule or persistent location system was added.
- Controlled browser fixtures and synthetic scheduling tests do not substitute for extended manual gameplay, real GPU FPS or full heap/VRAM profiling.
- Existing HUD subtitle remains Phase 4.1 because the HUD was preserved.

## 13. Manual acceptance checklist

- Find the orange coupe in the northwest loop and cream sedan in the southeast loop. Follow each through complete loops; inspect lane direction, legal left turns, gradual slowing, steering and wheel roll.
- Park a player car ahead with room to stop; verify stand-off, brake lamps, no active pushing and resume after moving away. Test cautious player approach/crossing near traffic.
- Observe all three pedestrian routes, endpoint pauses, smooth facing/gait, pavement height and clearance from furniture. Stand in a route, then move aside and verify stop/resume.
- Confirm walkers and traffic have no E hints and cannot be entered or talked to. Talk to Marcus/Maya and verify their original appearance/text and dialogue controls.
- Enter/drive/exit all three playable cars near agents; check safe exit, handbrake, reverse, recovery and retained player-only HUD/camera ownership.
- Inspect day/night car lights, walkers, streetlights/windows and sky. Check pedestrian/vehicle cameras, C orbit, P debug, F performance and Shift+T.
- Recheck creator/presets/clothing/persistence, walking/sprint/jump/step-up, all roads/driveways, props and physics yard.
- Review longer sessions and actual desktop GPU performance/resource behavior. Manual acceptance remains pending.

## 14. Git and stopping point

HEAD remains `5563934` on `main`; local identity unchanged. Only package scripts and World mounting are modified tracked files, with new ambient/test/report/browser files untracked. Nothing staged. No configuration/authentication changes, secret access, commits, pushes, deployment or blockchain operations. Work stops after Phase 4.2; Phase 4.3 requires explicit approval.
