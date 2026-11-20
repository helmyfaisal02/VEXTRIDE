# VEXTRIDE Phase 2.3 — Dynamic Day & Night

Implemented locally on November 20, 2026. Stopped at Phase 2.3. No push or deployment was performed.

1. **Initial inspection**

   This is the existing React/Vite/Three.js/R3F/Rapier game, not a new application. Phase 2.2 is present: six districts, 40 roads, 20 buildings, 413 props and the existing merged procedural environment. There was no `node_modules`; `bun install --frozen-lockfile` succeeded without changing `bun.lock`.

   The downloaded folder has no `.git` directory. `git status --short` returned “not a git repository”, so tracked/uncommitted status cannot be determined. Before editing, `src`, `scripts`, `package.json`, and `bun.lock` were copied to `/tmp/vextride-phase23-baseline`. Comparisons against that snapshot confirmed the changed paths below; unrelated source and existing tests were preserved.

   Before implementation, all existing regression scripts passed (546 PASS lines), and `bunx vite build` succeeded. There was no `build` script. Full-project lint and TypeScript already failed in `scripts/compass-deploy.ts` because its imported `@circlefin/compass-chains` package is absent.

2. **Phase 2.3 work already present**

   No clock, dynamic time state, day/night driver, or time controls were found. `Lighting` already contained the single directional light with a player-following, two-meter-snapped shadow target. `SkyDome` already used a gradient shader and fixed sun glow. The environment already had streetlamp geometry and deterministic `windowGrid.litEvery` cells colored with `PAL.glassWarm`. These existing systems were extended and reused.

3. **Files created or modified**

   Modified:

   - `package.json`: added `build`, `verify:world-time`, and appended the new tests to `verify:all`.
   - `src/game/world/World.tsx`: mounted the clock driver.
   - `src/game/world/Lighting.tsx`: updated existing sun, ambient, hemisphere and fog objects.
   - `src/game/world/SkyDome.tsx`: dynamic colors, sun direction, stars and viewer-centered dome.
   - `src/game/environment/envGeometry.ts`: attached emission masks once at geometry creation.
   - `src/game/environment/EnvironmentView.tsx`: shared emissive material and small light pool.
   - `src/game/hud/Hud.tsx`: clock HUD, development shortcut hint and Phase 2.3 label.

   Created:

   - `src/game/world/worldTime.ts`: clock model, progression, formatting and persistence validation.
   - `src/game/world/dayNight.ts`: continuous lighting/sky sampling.
   - `src/game/world/WorldTimeDriver.tsx`: one frame-loop driver and safe persistence lifecycle.
   - `src/game/environment/environmentLighting.ts`: deterministic emission attributes and standard-material shader extension.
   - `src/game/environment/StreetLights.tsx`: configurable pool of nearby non-shadow point lights.
   - `src/game/hud/WorldTimeHud.tsx`: time display and development-only controls.
   - `scripts/verify-world-time.ts`: eight focused test groups.
   - This report and `docs/phase23/` browser evidence: five PNG screenshots and two JSON result files.

4. **World clock**

   `worldClock` exposes current fractional hours, pause state, developer setters, subscriptions and a serializable setting for future systems. A new session defaults to 10:00 AM. One game day takes 1,800 active real seconds. Advancement uses frame delta, independent of frame rate. Hidden documents do not advance; visibility changes skip the next frame, and invalid, negative or greater-than-one-second deltas are discarded. There is no offline catch-up.

   A separate versioned `vextride.world-time.v1` storage record persists the hour and pause setting. Storage is validated, exceptions are caught, and saves occur every 15 seconds, on visibility changes, page exit and driver cleanup. Character storage and its implementation are unchanged. If storage is blocked, the clock continues in memory.

   The HUD displays 12-hour time and Sunrise (05–07), Daytime (07–17), Sunset (17–19), or Nighttime (19–05). Only the HUD subscribes, with notifications at game-minute boundaries and explicit edits. Time never causes the city or physics tree to re-render.

5. **Lighting and sky**

   The original directional sun follows a continuous solar arc. Its color and intensity vary with time; ambient and hemisphere fill retain nighttime visibility. The original shadow map size, shadow bounds and snapped player-following target are preserved. There is still only one shadow-casting light.

   Reusable linear-space colors blend through night, dawn, daylight and orange/pink sunset keyframes using smooth interpolation. The midnight endpoints match. The sky glow uses the same sun direction as the directional light, and fog follows the same horizon color. Sparse procedural stars fade with night strength in the existing single-draw sky shader. The dome follows the camera so the sky direction stays aligned across the city.

6. **Streetlights and windows**

   A smooth night factor fades from 1 to 0 during 05–07, remains 0 during 07–17, rises to 1 during 17–19, and remains 1 overnight. Existing lamp diffuser surfaces use warm emission driven by this factor. No streetlight geometry or placement was changed.

   Four non-shadow point lights are the default real-light pool; the component allows a configurable count capped at eight. Every half second, it finds nearby existing lamps within 28 meters of the player. Occupied slots are retained where possible; changing slots fade out before relocation and fade back in. In the actual browser test, two nearby lights reached about 85 intensity after approaching lamps, while the other two remained inactive.

   Existing selected warm window panes receive a lower emission weight than lamp diffusers. The selection reuses `litEvery` and is deterministic across rebuilds. An attribute is computed once on each merged district mesh; one shared standard material adds warm emission through a scalar night uniform. Frames and unselected panes remain unchanged. No per-window mesh, extra building draw call, geometry rebuild, random flickering, or new facade was added. Storefront emission was optional and was not added separately.

7. **Performance considerations**

   Environment geometry retains its 12 nominal draw calls, six merged chunks and instanced trees. Emission adds one float per environment vertex and no extra draw calls. Lighting reuses colors, vectors, uniforms and light objects. Lamp selection runs twice per second. Pool lights cast no shadows. Existing physics, camera, character animation and performance overlay remain in place.

   Chromium used ANGLE/SwiftShader software rendering at 1280 × 800. One overlay sample measured **7 FPS, 147.8 ms, 53 calls, 23.7k triangles**. This is a software-rendered local measurement, not a mid-range GPU benchmark or evidence that the 30 FPS target is achieved.

8. **Validation results**

   | Check | Result |
   | --- | --- |
   | `bun run lint` | Fails with the same seven pre-existing typed errors in `scripts/compass-deploy.ts` caused by the missing package. |
   | `bun run typecheck` | Fails with the same pre-existing TS2307 missing-module error in that helper. |
   | `bunx oxlint --type-aware src/game scripts/verify-world-time.ts` | Passes. |
   | TypeScript over all `src` plus the new test, using a temporary config extending the project config | Passes. |
   | `bun run build` | Passes; existing large Rapier chunk warning remains. |
   | `bun run verify:all` | Passes: all 546 existing PASS cases plus eight new world-time groups. |
   | Chromium development WebGL | 22 recorded checks, including real movement, sprint, jump, pause, automatic progression, hidden-document freezing, persistence, F/P/C and nearby lamp illumination. |
   | Chromium production WebGL | Scene and clock render; Shift+T controls and shortcut hint are excluded; no runtime/shader errors observed. |

   New tests cover default time, 12-hour formatting, period boundaries, 30/60/144 FPS progression over a complete 30-minute cycle, midnight wrap, pause/resume, developer edits, hidden/stalled/invalid deltas, subscriber cadence, persistence validation, monotonic sunrise/sunset lamp fades, color/sun continuity and deterministic per-triangle window/lamp masks. Existing regression scripts cover city geometry, character creation/persistence, movement, collisions, slopes, step-up, camera behavior and environment physics.

   The browser harness needed repairs for a stale R3F reference after reload and for camera controls becoming available. Assertions completed before those harness errors are recorded as passed; a separate targeted render pass completed streetlamp capture and runtime/shader-error checks. These were harness errors, not errors raised by the game. An initial smoke run also saw a missing resource 404; it did not prevent WebGL rendering.

   Evidence: [browser results](phase23/browser-results.json), [production results](phase23/production-results.json), [sunrise](phase23/sunrise.png), [day](phase23/day.png), [sunset](phase23/sunset.png), [night](phase23/night.png), [nearby streetlamp and windows](phase23/streetlight-night.png).

9. **Known issues and limits**

   Full-project lint/TypeScript remain red because of the original exported deployment helper dependency. That unrelated helper was not rewritten or stubbed. The existing production bundle-size warning also remains. The downloaded folder has no Git history/status baseline.

   Hardware performance and extended human visual acceptance remain unverified. Browser snapshots establish that the scene renders in four periods; continuity tests establish mathematical behavior, but they do not replace watching a full cycle. A simulated hidden-document interval passed; prolonged real OS suspension still merits a manual check. Existing character regressions passed, but every preset and every traversal scenario was not replayed manually in this browser session.

10. **Manual browser acceptance checklist**

    Run `bun run dev`, open the local Vite URL, and press **Shift+T** after entering play. The controls are development-only and hidden by default. Selecting an hour pauses time; Resume or Automatic restarts progression from that hour. Escape or × closes the panel. Click the scene after interacting with controls to return keyboard focus to play.

    - [ ] Watch 05–07 and 17–19 continuously; verify gradual sky, fog, shadows, lamp and window changes without seams or flashes.
    - [ ] Inspect stars and the sun glow while rotating the camera; inspect the horizon across all districts.
    - [ ] Walk between lamp coverage areas at night; check fade/relocation behavior and visibility of the player, road edges, facades and signage.
    - [ ] Pause, set several hours, resume, reload, and verify time and guest character persistence independently.
    - [ ] Leave the browser tab inactive for several minutes, return, and verify there is no catch-up jump.
    - [ ] Replay all three presets, customization, walking, sprinting, jumping, slopes, step-up and building/prop collisions.
    - [ ] Check camera drag/zoom, follow/orbit transitions, F performance overlay and P collider debug in daylight and at night.
    - [ ] Measure sustained FPS on the target desktop GPU while traversing all six districts; the 30 FPS target is not yet accepted.
    - [ ] Watch a full approximately 30-minute cycle for long-run visual and timing acceptance.

No vehicles, NPCs, missions, economy, multiplayer, authentication, wallet/blockchain, Supabase, weather, buildings, districts, Phase 2.4, or Phase 3 features were implemented.
