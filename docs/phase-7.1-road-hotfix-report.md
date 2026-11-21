# VEXTRIDE Phase 7.1 hotfix — Road surface rendering

## Initial state

Read AGENTS.md and the Phase 7.1 report. Verified `main`, HEAD `729381f`, and local identity `helmyfaisal02 <hijautua39@gmail.com>`. The working tree contained the expected unstaged Phase 7.1 changes. There were no unexpected unrelated changes. The previous saved regression log contains 1,097 PASS records. The hotfix preserves the existing interaction optimization, tree cleanup, wallet fallback, and WebGL context handling.

## Reproduction and diagnosis

Chromium used SwiftShader, with the actual game rendering at 1280 × 800 and a 24-bit default depth buffer. Test-only scene instrumentation relocated the pedestrian and set the normal third-person orbit to repeat camera angles. Between comparisons, layer visibility and a grid uniform were changed only in the browser fixture. No deployment or wallet interaction was involved.

1. Pause the game clock at 2:27 AM with Shift+T.
2. Stand by the road outside Dough & Daisy Bakery and Lumen Books and face diagonally toward the junction east of the stores. The capture uses player X/Z `(-40, -81)`, yaw `-1.03`, pitch `0.27`, and distance `14`.
3. Compare a close, more front-facing shot, where the problem was hard to see, to the above oblique view and a long main-road view from `(1, -120)`, yaw π, pitch `0.37`, distance `14`.

The oblique storefront shot reproduced bright green crossing lines over dark asphalt, adjoining pavement, and the junction. A long main-road view showed the same contamination in daylight and at night with collider debug off. The exact original owner capture was described in text. The evidence below establishes this reproduction and its cause without asserting that every fragment from the original screenshot matched pixel for pixel.

Layer isolation confirmed the legacy terrain grid was responsible for the green lines. Hiding only that Grid removed them. Keeping the mesh visible and changing its `infiniteGrid` uniform to false also removed them. Turning collider debug on produced distinct outline overlays. The normal scene and offscreen 16- and 24-bit depth targets showed the grid bleed in the long road view. The finding does not depend on a 16-bit buffer. Very thin white streaks at long distance tracked the lane and crosswalk marking layer, separate from the green grid bleed.

Inspected the actual city and environment builders and placement data. Road, junction, block and perimeter rectangles partition the full 115,600 m² city footprint without positive-area intersections between those tiles. No same-height, same-layer environment paint rectangle overlaps were found. Existing geometry checks cover valid winding, finite coordinates, road coverage and marking placement. The ground and city are layered at different physical heights, so the reproduced fault was not a coplanar road-face conflict. Shadow isolation did not account for the visible distant markings, and the green lines disappeared with the grid change while shadows and lighting remained enabled.

[Before, 2:27 AM storefront](phase71-road-hotfix/grid-before-bakery-long.png) · [Only grid hidden](phase71-road-hotfix/grid-before-bakery-long-hidden.png) · [Runtime uniform changed to finite](phase71-road-hotfix/grid-before-bakery-long-finite.png) · [After, same storefront angle](phase71-road-hotfix/grid-after-bakery-long.png)

## Smallest fix

The source was the Drei `Grid` in [Ground.tsx](../src/game/world/Ground.tsx), 1 cm above the terrain plane. The installed Grid shader multiplies its swizzled vertices by `1 + fadeDistance` in infinite mode. Applied to the existing 1,600 m plane with a fade distance of 160, this submitted a 257,600 m-wide quad beneath the city. At the reproduced camera angles, the expanded grid rendered through surfaces in front of it. Setting the grid to its finite terrain extent removed the demonstrated bleed. The comparison isolates the oversized grid path without assuming a specific hardware or driver defect.

Removed the `infiniteGrid` prop. The grid stays rendered on its existing terrain-sized plane, with the same position, cell sizes, colors and fade. No changes to depth settings, fog, shadows, road markings, render order, physics, colliders, camera clips, routes, terrain bounds, buildings or driveway geometry were needed.

The hotfix changes `src/game/world/Ground.tsx`, adds `scripts/verify-road-render.tsx`, and registers it in `package.json` alongside the existing hardening check. This report and the accompanying browser evidence are new. The focused check mounts the real Ground component through R3F and Rapier, evaluates the shader's effective world-space grid footprint using its live geometry and uniforms, and checks the original ground collider. Reintroducing expansion in the test is a negative control that fails at the terrain bounds assertion.

[Before at 2:27 AM](phase71-road-hotfix/grid-before-long-night.png) · [After night](phase71-road-hotfix/grid-after-long-night.png) · [Before daylight](phase71-road-hotfix/grid-before-long-day.png) · [After daylight](phase71-road-hotfix/grid-after-long-day.png)

## Browser sweep and limits

The updated scene was inspected at standard follow distance and zoomed out, at the oblique storefront pose and long-road pose, in Central Plaza and its adjacent intersection, on a Residential street, in Motor Row and at the garage parking area. It was also inspected with the Street Coupe chase camera while driving through a marked intersection. Vehicle placement at the start of that scenario was a fixture. Entry, throttle, braking and exit used normal controls. The driveway sweep covered both time settings for all four cuts, and the existing real Rapier tests retained traversal checks.

- [Central Plaza, night](phase71-road-hotfix/city-after-plaza-night.png) · [Adjacent intersection, day](phase71-road-hotfix/city-after-intersection-day.png) · [Residential, day](phase71-road-hotfix/city-after-residential-day.png) · [Residential, night](phase71-road-hotfix/city-after-residential-night.png)
- Garage bay [day](phase71-road-hotfix/city-after-garage-bay-day.png) and [night](phase71-road-hotfix/city-after-garage-bay-night.png), showroom [day](phase71-road-hotfix/city-after-showroom-day.png) and [night](phase71-road-hotfix/city-after-showroom-night.png)
- North parking [day](phase71-road-hotfix/city-after-north-parking-day.png) and [night](phase71-road-hotfix/city-after-north-parking-night.png), south parking [day](phase71-road-hotfix/city-after-south-parking-day.png) and [night](phase71-road-hotfix/city-after-south-parking-night.png)
- [Garage parking](phase71-road-hotfix/city-after-garage-parking.png) · [Moving chase camera](phase71-road-hotfix/city-after-moving-coupe-night.png) · [Grid outside the city](phase71-road-hotfix/city-after-outside-demo-yard.png)
- Additional sweep with [Central Plaza in daylight](phase71-road-hotfix/extra-central-plaza-day.png), the north T-junction by [day](phase71-road-hotfix/extra-north-t-junction-day.png) and [night](phase71-road-hotfix/extra-north-t-junction-night.png), and [daylight chase camera](phase71-road-hotfix/extra-moving-coupe-day.png).

No new road surface gaps, floating markings, or visual seams were observed in the sampled views. At long distance the original thin marking edges can still alias. No broad antialiasing changes were made. Hardware-specific output remains for owner verification.

Reproduce the browser coverage with the local development server on port 5178. Set `VEXTRIDE_PLAYWRIGHT_MODULE` and `VEXTRIDE_CHROMIUM` to the installed Playwright module and Chromium binary, then run `node docs/phase71-road-hotfix/browser-check.mjs capture`. The fixture measures grid changes from alternate renders of the same frame and restores the runtime setting after comparison.

## Measured comparison

Each row counts changed RGB pixels against a render of the same frame with only the grid hidden. The browser recreated the old uniform value as a positive control. These checks used the default 24-bit depth buffer.

| Sample region | Old expansion vs. hidden | Finite grid vs. hidden |
| --- | ---: | ---: |
| Main road at 2:27 AM | 2,920 | 0 |
| Same road in daylight | 3,227 | 0 |
| Night road by the retail façades | 6,747 | 0 |
| Exterior terrain by the demo yard | 0 | 787 |

At the paired oblique storefront angle, both runs recorded 132 draw calls and 28,682 drawn triangles. The long night view recorded 127 calls and 36,096 triangles in both runs. Road and marking geometry remain at 898 and 2,784 triangles respectively. Every sample in the updated sweep reported 47 Rapier bodies, 565 colliders and 22 frame callbacks. No runtime or shader errors were recorded. GPU geometry upload counters varied with what the camera had already seen and do not establish a resource gain.

The production app entry moved from 211.97 kB to 211.95 kB. Rapier and the lazy wallet bundle remained at their original sizes. The existing Rapier chunk warning remains. These are renderer and output measurements from Chromium SwiftShader and establish neither an FPS change nor hardware acceptance. [Browser measurements](phase71-road-hotfix/city-after.json) · [Before isolation](phase71-road-hotfix/grid-before.json) · [After comparison](phase71-road-hotfix/grid-after.json)

## Automated validation

| Command | Result |
| --- | --- |
| `bun run lint` | Passed |
| `bun run typecheck` | Passed |
| `bun run build` | Passed with the existing Rapier chunk-size warning |
| `bun run verify:all` | Passed 1,098 cases and groups, preserving the 1,097 baseline checks |

[Lint](phase71-road-hotfix/lint.txt) · [TypeScript](phase71-road-hotfix/typecheck.txt) · [Build](phase71-road-hotfix/build.txt) · [Full regressions](phase71-road-hotfix/verify-all.txt) · [Expanded-grid negative control](phase71-road-hotfix/negative-regression.txt)

## Manual acceptance checkpoints

1. Go to Dough & Daisy Bakery and Lumen Books and set the clock to 2:27 AM.
2. Look diagonally toward the east junction at the far follow zoom. Verify the green lines are gone.
3. Repeat at close distance and shallow pitch while rotating the camera.
4. Repeat the storefront and long main-road views in daylight.
5. Walk and jump over the storefront curb and cross the lane.
6. Inspect Central Plaza roads and a four-way intersection.
7. Inspect the Residential streets and a T-junction.
8. Walk or drive over the garage bay and showroom cuts.
9. Check the north and south parking cuts and garage parking surfaces.
10. Drive through a marked intersection using each of the available camera modes.
11. Verify night lamps, daylight shadows, and the exterior terrain grid near the demo yard.
12. Verify F, P, C and Shift+T behave as before, and repeat the original owner view on the original hardware.

## Git

The original Phase 7.1 changes and the hotfix remain unstaged on `main` at `729381f`. Local identity and Git history were preserved. There was no staging, commit, push, deployment, signing or transaction. Owner manual acceptance is pending, and Phase 7.2 was not started.
