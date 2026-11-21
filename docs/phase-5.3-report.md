# Phase 5.3 — Local Guest Progress Persistence

Phase 5.3 implementation and verification report. Owner manual acceptance remains pending. No Phase 6 work was started.

## Initial inspection

The initial working tree was clean on `main`, matching `origin/main`, at `1546789` (`feat: add VEXTRIDE Street Cash economy and respray`). Phase 5.2 was committed. Local identity was `helmyfaisal02 <hijautua39@gmail.com>` and was not changed. AGENTS.md and the existing mission, economy, garage proof, vehicle registry/recovery/paint, character storage, input, world initialization and verification code were inspected. Baseline regression verification passed all **1,054** existing cases/groups.

Previously, missions, economy, paint and parking were session-only. Character appearance and world time already had separate local storage. The garage uses closed solid doors and an exterior terminal; those accepted surfaces and colliders remain unchanged.

## Files

Created:

- `src/game/persistence/persistenceSchema.ts`: serializable versioned snapshot types/key.
- `persistenceStorage.ts`: guarded localStorage access.
- `persistenceValidation.ts`: ledger replay, mission/core consistency, pose and bay record validation.
- `persistenceRuntime.ts`: initialization/write/error state and mutation guards.
- `persistenceHydration.ts`: actual Rapier placement validation and stationary restoration.
- `persistenceCoordinator.ts`: coherent hydration, subscriptions, save cadence, lifecycle flush and reset.
- `ProgressDriver.tsx`: stable world lifecycle and after-physics callback.
- `src/game/hud/GuestProgressSettings.tsx`: local status, warning and explicit reset confirmation.
- `scripts/verify-persistence.ts`: 20 additional focused verification groups.
- This report and the evidence in `docs/phase53/`.

Modified:

- `src/main.tsx`, `src/game/world/World.tsx`: initialize before React gameplay, wait for validated physics placement, mount driver.
- `src/game/missions/missionState.ts`, `src/game/hud/MissionDialogueActions.tsx`: block progression during hydration or rejected-save recovery.
- `src/game/input/useKeyboardInput.ts`, `src/game/interactions/interactionCoordinator.ts`: suppress input during restoration using the existing architecture.
- `src/game/economy/garageResprayService.ts`: reserve restored processed operation IDs, preventing respray ID reuse.
- `src/game/garage/parkingDetector.ts`: export confirmed proof and revalidate previously earned parking after restoration.
- `src/game/vehicles/vehicleRecovery.ts`: optional collision-query predicate for grouped restoration; normal recovery behavior unchanged.
- `src/game/vehicles/vehicleState.ts`, `src/game/vehicles/Vehicle.tsx`: reset transient simulation/recovery state on a restoration revision.
- `src/game/hud/Hud.tsx`, `GaragePanel.tsx`, `GarageRespray.tsx`: show local-save status/reset and remove the obsolete refresh-reset caption.
- `package.json`: add `verify:persistence` to `verify:all`.

No dependency/lockfile changes. No new paints, vehicles, missions, NPCs, bodies, lights, city geometry or handling changes.

## Schema and storage

One plain JSON capsule uses **`vextride.guest.progress.v1`**, schema version **1**. It contains saved timestamp, mission status/objective/completion history, integer balance/ordered ledger/paint selections, claimed reward and processed operation IDs, three playable vehicle poses with layout version, and earned parking records tied to those poses.

Only primitive serializable data is saved. Rapier/Three objects, callbacks, materials, cameras, held input and velocity are excluded. Existing character key `vextride:guest:character`, world-time storage and unrelated localStorage are preserved.

## Hydration and saves

Initialization occurs once before gameplay renders. The coherent mission/economy core is validated and applied in one store patch without invoking mission transition/reward effects. Dialogue session nonces restart safely; old completion notifications are not replayed.

Once the real physics world and three bodies exist, saved positions are checked, vehicles are restored upright with zero linear/angular velocity, input is cleared and the player remains on foot. Garage proof is revalidated during a short settling period before gameplay input resumes. Same-world StrictMode-style reconnects do not repeat hydration. A genuine world remount gets fresh valid body references.

Meaningful mission, economy and occupancy changes schedule a **250 ms** debounced save. Safe vehicle transforms are sampled every **2 simulation seconds**. `pagehide` and hidden-document events attempt a final flush; cleanup removes subscriptions/listeners and pending timers. Canonical fingerprints skip unchanged writes. One `setItem` replaces the coherent capsule; no split mission/economy writes occur.

The UI distinguishes pending writes from successful local saves. Failed writes never update the successful saved timestamp. An external tab changing this key blocks further progress writes/rewards until reload rather than overwriting the other tab's capsule.

## Missions and economy

Both mission flows, checkpoint positions and directional crossing rules are unchanged. Every reachable active objective, including Shakedown checkpoints and final report, is restored. First Contact completion still unlocks Shakedown; completion history remains independent and ordered.

Validation replays the ledger from zero using existing transaction rules: exactly 150 SC and 300 SC for the respective legitimate reward records, 125 SC for each known respray, integer amounts, unique operation IDs, consecutive sequence numbers and correct resulting balances. Claimed rewards, mission completion history and purchased paint must agree with that replay. Hydration never issues a reward or charges a respray. Processed respray identities remain consumed across reloads.

## Paint, safe poses and garage occupancy

Restored paint goes through the existing per-vehicle body-paint bindings. Glass, trim, wheels, signals and ambient paint are unchanged. Restoring selections is not a purchase and allocates no extra per-frame materials.

Each pose must be finite, within city bounds and near the known surface height. Actual Rapier ground support and chassis/runner clearance queries validate against current static/dynamic obstacles. The three managed cars are checked as a group with conservative oriented footprints, avoiding their old spawn poses blocking otherwise valid targets. Invalid/overlapping records fall back to safe existing original spawns independently; other progress remains intact. If even a fallback is physically blocked, restoration waits/retries instead of forcing a car into geometry.

Only detector-confirmed parking proof is saved. On reload its vehicle must actually restore to the matching pose and bay with valid full footprint/orientation, support, stationary state and clearance. Duplicate/conflicting bay claims are rejected. The original stationary verification interval rebuilds occupancy. This preserves previously earned parking without pretending a fresh drive-in occurred. New arrivals still require normal actual driving and exit. Moving, entering or recovering the car invalidates eligibility as before. Ambient agents never enter this registry.

## Corruption and reset policy

Missing data starts at zero with default missions/paint/poses. Malformed JSON, unsupported versions or an inconsistent mission/economy core are **preserved without overwrite**; rewards and paid services are blocked, ordinary exploration/dialogue and garage reset remain accessible. The player sees a warning and must explicitly confirm reset. No currency/history is invented to salvage inconsistent core data.

Unsafe individual vehicle or parking records are discarded independently and revalidated against the world. Privacy/unavailable-storage and quota failures fall back to in-memory gameplay with an honest warning; the previous durable capsule remains unchanged. A failed removal does not partially reset state.

Garage Panel → **Guest Progress · This Browser** → **Reset guest progress** → **Confirm reset guest progress** clears only this progress snapshot, then restores zero balance/ledger, both missions, factory paint, safe original vehicle poses and empty earned parking. Cancel preserves everything and returns focus. Character appearance and unrelated keys are not removed.

## Performance and resources

No per-frame JSON parsing, localStorage writes or React state updates were added. There is one ref-counted coordinator with two store subscriptions, one after-physics callback and three lifecycle/storage listeners. Cleanup/remount tests cover releasing these resources. Snapshot size is limited to 64 KiB and ledger validation to 64 entries; current one-time rewards and service price naturally bound successful session transactions much lower.

The browser retained **47 physics bodies / 565 colliders**, including the unchanged two traffic vehicles and three ambient pedestrians. No geometry/material/light population increase was introduced. Hardware FPS was not measured; Chromium uses SwiftShader.

## Automated validation

| Command | Actual result |
| --- | --- |
| `bun run lint` | PASS, exit 0 |
| `bun run typecheck` | PASS, exit 0 |
| `bun run build` | PASS, exit 0 |
| `bun run verify:all` | PASS, exit 0; **1,074 cases/groups**, preserving all 1,054 previous cases/groups |

Logs: [lint](phase53/lint.log), [TypeScript](phase53/typecheck.log), [build](phase53/build.log), [regressions](phase53/verify-all.log).

The 20 new groups use real Rapier worlds where applicable. They cover all saved mission stages; no replayed reward/debit; actual fixture-world drive-in/respray/pose/paint restoration; safe fallback and overlapping cars; conflicting parking; malformed/future/inconsistent data; invalid IDs/amounts; quota/read/removal failures; subscription/listener cleanup; nonce reset; external-tab conflict and explicit reset with character preservation.

Production output: application JS 208.89 kB (71.43 kB gzip), CSS 20.10 kB (4.44 kB gzip). The existing 2,058.37 kB Rapier vendor chunk triggers Vite's size warning. Browser requests also encounter the existing missing `favicon.ico` (404); no runtime/shader errors were observed.

## Browser evidence and scope

Chromium/WebGL (SwiftShader) ran the actual existing game with normal keyboard/UI controls. Body teleportation, forced velocity and direct store progression were **not** used for the physical mission/parking journey. Read-only runtime inspection and camera-yaw steering assist the harness.

- Started at zero; walked to Maya and accepted First Contact.
- Refreshed mid-First Contact and restored the Marcus objective with no reward.
- Physically visited Marcus and returned to Maya, earning 150 SC.
- Accepted Shakedown, entered the existing Coupe and drove directional checkpoint A.
- Refreshed mid-Shakedown; restored checkpoint B, 150 SC and the stationary road position, with the player back on foot.
- Walked back to the saved car, drove B and C, returned to Marcus on foot and earned the remaining 300 SC: **450 SC**.
- Drove into Bay 1, exited, earned actual parking, walked to the terminal and confirmed an Ember Red respray. A duplicate confirmation generated one debit: **325 SC / three transactions**.
- Refreshed and checked both completed missions, actual paint material, valid bay pose and earned occupancy.
- Walked back to the restored Coupe, entered and physically reversed out of the bay; occupancy cleared without changing cash. Another refresh retained 325 SC, three transactions and no stale parking.
- Fully closed and reopened the browser using the same local profile; balance, completion history and actual paint remained correct, with 47 bodies, 565 colliders and five ambient agents.

The final [browser result](phase53/browser-results.json) records **25 passed journey checks**, no runtime/shader errors and only favicon 404 warnings. Representative images: [450 SC after missions](phase53/missions-complete-450.png), [paid respray and parking](phase53/paid-325-before-reload.png), [restored HUD](phase53/restored-325-hud.png), [reopened browser](phase53/reopened-browser-325.png).

The parking harness initially stopped against an existing lot light pole, then resumed in the same live session using normal reverse/steering. It subsequently needed a normal parking alignment correction. These were automation-navigation failures; accepted city geometry and vehicle handling were not changed. A browser-process interruption during the later departure walk required reopening the same profile; the valid earned save restored correctly. See the final browser result for the completed departure/reopen checks.

Separate **44 storage/UI fixture assertions** seed the physically earned snapshot or deliberately corrupted copies and explicitly position the pedestrian for nearby NPC/terminal access. They are not additional physical gameplay journeys. They verify valid/corrupt/future/inconsistent hydration, ordinary dialogue without duplicate offers, narrow 375×812 layout, reset confirmation/cancel, character preservation, quota failure, prior durable save restoration, nighttime/debug shortcuts and unchanged body/collider counts. Evidence: [fixture results](phase53/fixture-results.json).

Screenshots and machine-readable final results are in `docs/phase53/`; the earned snapshot is test evidence only and is never imported by application startup.

## Limitations

- Local guest data is not tamper-proof, authenticated or redeemable. A coherent, manually forged client snapshot cannot be historically authenticated without a trusted service; validation checks consistency and current physical safety.
- Saves are best effort. A crash before a pending debounce/transform sample or lifecycle flush may lose recent changes; the prior complete capsule remains the fallback.
- Browser storage deletion, private browsing policies or quota limits can prevent persistence. No cloud backup/sync or account exists.
- A future schema is preserved and blocked; no speculative downgrade migration occurs.
- Pathological obstruction of every safe fallback can keep placement validation waiting rather than overlap solid geometry.
- The full physical journey uses the Coupe. All three paint/pose profiles and broader vehicle/traffic/camera behavior are covered by regression tests, not three repeated owner gameplay journeys.
- No hardware FPS or owner manual acceptance is claimed.

## Owner manual acceptance checklist

- [ ] Fresh profile starts at zero; character creator and normal controls work.
- [ ] Refresh during each mission; HUD/waypoint restores the current objective.
- [ ] Complete both missions for 450 SC; dialogue/remount/reload never repeats rewards.
- [ ] Physically park and exit each playable model in a valid garage bay.
- [ ] Buy a 125 SC paint change; refresh/reopen restores 325 SC, three transactions and only that car's body paint.
- [ ] Parked pose/occupancy survives reload; drive away and refresh without stale occupancy.
- [ ] Switch cars and use recovery; no false parking or checkpoint credit appears.
- [ ] Test bad/future save and quota failure in a disposable profile; warnings are clear and old data is preserved.
- [ ] Cancel reset preserves progress; confirmed reset preserves saved character appearance.
- [ ] Check day/night, traffic/pedestrians, Marcus/Maya, cameras, F/P/C/Shift+T and normal driving.

## Git boundary

All Phase 5.3 changes remain unstaged. No Git configuration/authentication, history, staging, commit, push, deployment or blockchain action was performed. Phase 6 requires explicit approval.

Final branch/HEAD/identity remain `main`, `1546789`, `helmyfaisal02 <hijautua39@gmail.com>`. There are 15 modified tracked files plus the new persistence modules, HUD component, verification script and report/evidence. `git diff --check` passed; the staged diff is empty.
