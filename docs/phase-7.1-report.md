# VEXTRIDE Phase 7.1 — Performance and stability hardening

## Initial repository inspection

Phase 6.3 was committed at `729381f` on `main`, tracking `origin/main`. The working tree was clean and the required local identity matched `helmyfaisal02 <hijautua39@gmail.com>`. Read AGENTS.md and inspected the React and R3F bootstrap, geometry ownership, Rapier fixed step and interaction paths, ambient agents, day/night, HUD, save coordinator, lazy wallet and history lifecycle. The unmodified baseline passed **1,095** verification cases and groups.

## Measurement method

The browser ran Chromium with SwiftShader. The production scenario observed startup module requests, guest startup, mobile wallet opening, mocked history, disconnect and reload. The development diagnostic harness read R3F renderer counters and active subscribers, traversed live scene assets, instrumented DOM listener and storage calls, and read Rapier counts from the live player body. It also unmounted and remounted the existing React root twice. All wallet providers and RPC responses in the browser check were mocked.

The browser used actual inputs for character creation, walking, sprinting, camera/debug controls, NPC dialogue, garage actions, vehicle entry, reverse, braking and exit. A previously earned Phase 5.3 save supplied the parked Coupe and completed missions. Test-only pedestrian relocation shortened travel to NPCs and garage locations. No city geometry, vehicle poses, physics settings or game stores were modified to perform those local interactions. Endurance and active mission-state coverage also came from the existing automated simulation and integration groups.

The baseline included a desktop city view and a 375 × 812 mobile wallet. Views were sampled at comparable points in the two runs. Frame time, draw calls and heap counters are samples affected by camera, elapsed time, startup and scheduling. The 3-second CDP TaskDuration sampling is a trace of renderer tasks as a whole. There is no hardware FPS or application-wide CPU gain claim.

Reproduce the focused interaction timing from the repository root with `bun run docs/phase71/interaction-benchmark.ts`. It warms the production coordinator against a real city Rapier fixture and takes seven timings of 50,000 repeated calls for a clear nearby car and a remote player. Each operation follows the existing fixed-step interaction path. It does not advance the whole physics simulation in that timed section. To repeat the browser sequence, serve a local production build on port 4175 and the matching Vite source on 5175. Provide installed Playwright and Chromium paths to the [browser harness](phase71/browser-check.mjs) via `VEXTRIDE_PLAYWRIGHT_MODULE` and `VEXTRIDE_CHROMIUM`, then run `node docs/phase71/browser-check.mjs sample http://127.0.0.1:4175`. Add `--extended` for extended activity, respray and context restoration. Test-only browser instrumentation is not part of the build.

## Findings and implementation

| Finding | Targeted change |
| --- | --- |
| The central coordinator selected a car, then the vehicle branch repeated the full nearby scan and occlusion check the same tick. Distant candidates also read velocity before their distance test. | Pass the selected eligible car, or an explicit no-car result, from the coordinator. Reuse the search position data and check distance before velocity. Standalone vehicle callers can still search for themselves. |
| The three instanced tree geometries and two shared materials were passed to the meshes but did not receive disposal on unmount. | Dispose those five component-owned resources once per teardown. R3F still owns the instance objects and their buffers. |
| GameCanvas registered another context-loss listener, although Three's renderer already calls preventDefault and restores its internal state. | Remove the redundant application listener and keep the renderer's existing recovery behavior. |
| A failed optional wallet chunk propagated to the game error boundary and replaced the running world. | Render a local wallet-load fallback in the existing closable dialog. A page reload can retry the chunk. |

The core world and established rendering strategy already use merged meshes, instanced trees, cached material sets, and widely scoped cleanup. The HUD mostly uses narrow Zustand selectors, a DOM performance readout, and throttled mission readouts. A React subscription rewrite was not justified. No lighting, geometry placement, input priority, physics timestep, vehicle tuning, camera behavior, NPC or traffic routes changed.

Guest persistence already throttles meaningful transitions, deduplicates snapshots and avoids per-frame storage writes. Wallet recovery checks are bounded, the history storage listener is scoped to the open panel, and the mock provider had zero application listeners after disconnect on the production build. Those policies are unchanged. The wallet load fix adds no RPC calls or transfer behavior.

## Files

- `src/game/interactions/interactionCoordinator.ts` and `src/game/vehicles/vehicleInteraction.ts` reuse one selection and one eligibility ray.
- `src/game/environment/EnvTrees.tsx` disposes the owned instancing assets.
- `src/game/GameCanvas.tsx` removes an app listener already provided by Three.
- `src/game/blockchain/ArcWallet.tsx` isolates the optional-module load error.
- `scripts/verify-hardening.tsx` adds actual Rapier interaction and repeated R3F tree lifecycle checks. `package.json` registers the groups in `verify:all`.
- `docs/phase71/` contains benchmark, browser and build evidence and optional reproduction scripts.

## Measured interaction changes

| Real Rapier fixture | Before | After |
| --- | ---: | ---: |
| Eligibility rays per clear nearby-car step | 2 | 1 |
| Median time for 50,000 nearby coordinator calls | 451.43 ms | 190.25 ms |
| Median time for 50,000 remote coordinator calls | 216.50 ms | 45.62 ms |

These are elapsed timings from an isolated benchmark, with environment and scheduling variation. The deterministic result is one fewer eligibility ray at the observed nearby pose, no repeat search on the walking branch, and preserved immediate obstruction and E entry checks. [Before timing samples](phase71/bench-before.json) · [After timing samples](phase71/bench-after.json)

## Browser resource comparison

| Metric | Before | After |
| --- | ---: | ---: |
| Draw calls and triangles at initial and remounted spawn | 99 / 25,622 | 99 / 25,622 |
| Live scene geometries and materials at spawn and both remounts | 269 / 110 | 269 / 110 |
| Renderer-uploaded geometries after each remount | 197 | 197 |
| Active frame callbacks | 22 | 22 |
| Rapier bodies and colliders while mounted | 47 / 565 | 47 / 565 |
| Rapier bodies and colliders observed after unmount | 0 / 0 | 0 / 0 |
| Instrumented window and document listener counts while mounted | 29 / 4 | 29 / 4 |
| Instrumented window and document listener counts after teardown | 18 / 1 | 18 / 1 |
| Context-loss listeners on retained old test canvas | 2 | 1 |
| Tree geometry / material disposals on each teardown | 0 / 0 | 3 / 2 |
| App provider listeners after mock disconnect in production | 0 | 0 |

The updated browser also observed 13 before-step and three after-step Rapier callbacks on both remounts. Browser uploads depend on what has been rendered by the sample time. The differing first-sample counts (198 and 136) are not treated as a GPU improvement. Total scene counts and comparable remount counts remained equal. The three-second idle TaskDuration samples were approximately 1,037 ms and 1,033 ms. Spawn heap samples after a GC request were both approximately 70 MB. Remount heap samples varied, and the listener instrumentation intentionally kept test references to detached canvases. The samples do not establish a long-horizon memory trend or a measurable application-wide speedup. The disposal-event and duplicate ray changes are directly attributable to the patch.

Walking and night samples showed no additional guest-save writes in either run. Writes resumed for meaningful events such as respray, vehicle movement and parking. No runtime or shader errors were observed. [Before browser metrics](phase71/before-dev-browser.json) · [After browser metrics](phase71/after-browser.json) · [Updated world](phase71/after-world.png) · [Mobile wallet](phase71/after-mobile-wallet.png)

## Bundle diagnostics

| Production artifact | Before | After |
| --- | ---: | ---: |
| Game entry JS | 211.75 kB | 211.97 kB |
| Renderer/vendor | 1,014.01 kB | 1,014.01 kB |
| Rapier | 2,058.37 kB | 2,058.37 kB |
| Optional wallet | 300.96 kB | 300.96 kB |

The baseline and updated production browser each requested the game, renderer and Rapier chunks on startup. They requested the wallet chunk only on opening Arc Wallet. The fixed app entry is about 0.22 kB larger uncompressed. Rapier's embedded Base64 WASM is about 1.92 million characters representing 1,439,831 decoded bytes, plus JS glue. The warning threshold and chunking stay in place. The physics module is needed for the initial world, and changing its WASM packaging was not supported by a safe measured benefit here. [Baseline build](phase71/baseline-build.txt) · [After build](phase71/build.txt)

The extended after-run had one 20.7-second creator outlier under concurrent test load. Three interleaved before/after runs after the regression suite ended did not reproduce it. Median creator-ready samples were 237 ms before and 243 ms after. Median navigation-to-playable samples, including automated creator input, were 3,170 ms and 3,313 ms. Median wallet-open-to-connected-mock-history samples were 929 ms and 879 ms. These are three local samples per build, with browser and automation overhead. They do not establish a loading-speed gain or a regression. The intercepted wallet chunk failure was independently reproduced in the baseline and contained in the updated build. [Isolated startup repeats](phase71/production-startup-repeats.json)

## Long-session coverage

The regression suite runs 108,000 mixed physics steps per playable vehicle, equivalent to 30 simulated minutes each. All three retained stable finite poses, speed caps, grounded behavior and constant fixture resources. The existing ambient tests run sustained city loops and pedestrian movement and check yielding, obstacle clearance and remount behavior. Mission progression, garage parking, persistence write policy, provider cleanup and transaction recovery retain their existing integration coverage.

The updated browser added 56 seconds of walking and camera switching after the two remounts. It used the actual garage UI to respray the recovered parked Coupe for 125 SC, and selected all three presets through Character Creator. An induced context loss via `WEBGL_lose_context` was prevented from becoming permanent by Three's listener, and the renderer resumed the same draw and triangle counts after restoration. The changed preset accounted for the different active scene geometry and material counts. No hardware, long-horizon heap trend or owner acceptance conclusion is inferred from this setup.

The full on-foot city and wallet UI path ran in Chromium. Short in-browser driving used the Coupe. Long drives and all three profiles, vehicle switching, ambient agents and mission transitions were covered by automation in the existing suites. The browser run does not substitute for a long hardware play session.

## Validation results

| Command | Result |
| --- | --- |
| `bun run lint` | Passed |
| `bun run typecheck` | Passed |
| `bun run build` | Passed with the existing Rapier chunk size warning |
| `bun run verify:all` | Passed **1,097** cases and groups, preserving all 1,095 baseline checks |

[Lint](phase71/lint.txt) · [TypeScript](phase71/typecheck.txt) · [Build](phase71/build.txt) · [Regression log](phase71/verify-all.txt)

## Manual acceptance checkpoints

1. Cold-start as a guest. Verify the city loads, the creator works and the wallet does not prompt.
2. Select all three presets and verify the saved character after reload.
3. Walk, sprint, jump and switch the C camera. Check F, P and Shift+T.
4. Walk toward a parked car, check the E hint, enter and exit, then verify a blocked approach does not enter.
5. Drive and recover each playable vehicle, checking handling, brake and reverse lights.
6. Observe ambient traffic and pedestrians during a longer drive and near junctions.
7. Switch day and night. Check streetlights, window emission and the world-time HUD.
8. Talk to Maya and Marcus and check First Contact and Shakedown objectives.
9. Park, review a respray and verify the correct debit and paint, then reload the guest save.
10. Open and close Arc Wallet on desktop and mobile. Verify the guest game still runs when the wallet chunk is unavailable.
11. Use a mock provider to check wallet disconnect, network changes, history recovery and Escape focus.
12. Reload several times and use the FPS overlay. Check for accumulating resources, renderer or shader errors on actual hardware.

## Git

The working changes are unstaged on `main` at `729381f`. The local identity was preserved. No commits, push, deployment or blockchain transaction occurred. Phase 7.2 was not started.
