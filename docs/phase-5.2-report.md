# Phase 5.2 — Street Cash Economy

## 1. Initial repository inspection

Started on clean `main`, tracking `origin/main`, at **6c8e969** (`feat: add VEXTRIDE garage hub and parking system`). Local identity: **helmyfaisal02 <hijautua39@gmail.com>**. Read AGENTS.md; inspected both mission transitions/managers/dialogue actions, garage UI/parking proof, actual vehicle geometry/material ownership, registry, HUD, Zustand stores, shared E/input architecture and existing tests.

Baseline lint, TypeScript and full verification all exited 0, with **1,023 passing cases/groups**, before implementation. No unrelated dirty work was present.

## 2. Files created or modified

Created:
- `src/game/economy/economyConfig.ts`
- `src/game/economy/economyState.ts`
- `src/game/economy/economyTransactions.ts`
- `src/game/economy/missionRewards.ts`
- `src/game/economy/garageResprayService.ts`
- `src/game/economy/economySelectors.ts`
- `src/game/vehicles/vehiclePaint.ts`
- `src/game/vehicles/playerPaintBinding.ts`
- `src/game/hud/EconomyHud.tsx`
- `src/game/hud/GarageRespray.tsx`
- `scripts/economy-fixture.ts`
- `scripts/verify-economy.ts`
- This report and evidence under `docs/phase52/`.

Modified:
- `src/game/missions/missionState.ts`: atomic completion/reward and debit/paint state actions.
- `src/game/garage/parkingDetector.ts`: expose and revalidate earned parking proof for paid services.
- `src/game/vehicles/Vehicle.tsx`: private body-paint material binding and cleanup.
- `src/game/hud/GaragePanel.tsx`: respray/history integration and focus loop including selects.
- `src/game/hud/Hud.tsx`: mount the Street Cash HUD.
- `src/game/hud/MissionHud.tsx`: guarded reward feedback and vertical spacing.
- `src/game/hud/WorldTimeHud.tsx`: developer-panel spacing/layering to accommodate currency.
- `scripts/verify-mission-integration.tsx`: extend real mounted gameplay, rewards, paint and cleanup checks.
- `scripts/verify-missions.ts`: rename an obsolete no-rewards test description; preserve its assertions.
- `scripts/verify-vehicle-fleet.tsx` and `scripts/verify-vehicle-stability.tsx`: update material ownership assertions for private paint, retaining shared-glass and cleanup checks.
- `package.json`: add economy verification to the full suite.

No dependencies, lockfile, environment, authentication, vehicle physics/handling, city geometry, NPC definitions, traffic routes or persistence changes.

## 3. Street Cash architecture

Street Cash is fictional, local gameplay currency, displayed as integer **SC**, starting at **0**. It has no real-money, crypto, payment or withdrawal function.

The existing Zustand mission store now contains an economy snapshot: balance, deterministic sequence, transaction history and three paint selections. The existing mission API remains. Mission and economy data share one store atom so completion/credit and debit/paint selection commit consistently in one write. Economy selectors expose only the required UI slices; no arbitrary balance-setting action is provided to UI components.

Configuration, snapshot types, pure ledger processing, reward integration, paid-service validation, paint rendering and UI are separate modules. No network endpoint, database or persistence backend was added.

## 4. Mission rewards

| Mission | Reward | Unique reward operation |
| --- | --- | --- |
| First Contact | 150 SC | mission:first-contact |
| Motor Row Shakedown | 300 SC | mission:motor-row-shakedown |

Rewards run synchronously inside the existing validated ACTIVE-to-COMPLETED transition, with the expected completed-history entry. They do not run in effects or when dialogue opens, acceptance occurs or checkpoints advance. The same guarded store update publishes progress, completion notice and credit together. Duplicate completion or reward IDs cannot issue additional cash. Completing both missions produces **450 SC**.

## 5. Ledger and idempotency

Each successful entry records a unique ID, EARN/SPEND type, positive integer amount, reason, related mission or vehicle/paint ID, deterministic sequence and resulting balance. No floating-point currency, negative balance or negative reward amounts. Invalid amounts/references, duplicate IDs, overflow and insufficient debits are rejected without changing the snapshot/history.

Mission IDs have deterministic reward namespaces. Each respray review creates one operation identity reused by confirmation. UI guards improve repeated-click feedback; centralized validation and ledger idempotency enforce safety independently of button disabling. Rejected/cancelled operations do not create successful history entries.

## 6. Garage respray service

Price: **125 SC per successful color change**. The existing terminal/panel is reused. The player selects a preset, reviews the exact vehicle/color/price, then explicitly confirms or cancels.

The service validates the playable ID and palette, live body and render slot, on-foot garage context, current terminal range/visibility and the parking detector's earned proof. It rechecks actual body identity, recovery revision, footprint, motion, support and chassis clearance at confirmation, avoiding the 10 Hz UI snapshot's possible staleness. Ambient and unparked vehicles cannot qualify.

The requested color must differ and funds must cover 125 SC. A valid operation creates exactly one SPEND entry and updates the selected paint and balance atomically. Failure leaves all three unchanged. The service does not move, spawn, repair or change vehicle stats.

## 7. Paint and material isolation

| Vehicle | Original factory paint |
| --- | --- |
| Street Coupe | Factory Teal — #319ca7 |
| City Sedan | Factory Slate Blue — #667da6 |
| Utility Pickup | Factory Amber — #c88a3f |

Each also offers **Ember Red (#e45d43)** and **Metro Violet (#8059c9)**.

Inspection confirmed body builders contain uniform baked paint, with glass, trim, wheels and lamps separate. Playable body vertex colors normalize to white once on mount; the existing factory-created body material becomes a vehicle-private diffuse paint slot. Setting its original factory color preserves the original appearance. Later resprays change only that material's existing color uniform. No geometry rebuild or material replacement occurs during purchases or driving.

Glass, trim and tires remain shared. Head/tail/reverse lighting and wheel animation remain unchanged. Ambient traffic retains its separate baked color/shared-material path and is never registered in player paint slots. Bindings unsubscribe, clear references and dispose private body materials on unmount. Remount restores the session selection without spending again.

## 8. HUD and garage UI

A small **STREET CASH: … SC** card sits below the world clock. The mission card and developer time panel move down slightly to avoid overlap; their behavior remains. Existing five-second completion feedback also shows the actual credited transaction, e.g. **+150 SC — First Contact Complete**. No effect issues currency.

The garage keeps its vehicle catalog and parking status, adding current/selected paint, exact cost, review/confirm/cancel, result messages and five recent ledger entries. It explains that fictional cash/resprays reset on refresh. Focus trapping now includes selects; opening/closing, Escape and input locking remain in the accepted architecture. No new global keyboard listeners or expensive previews.

## 9. Session lifecycle

Cash, history, mission progress and paint selections are session-only. Component/fleet remounts retain the current snapshot; body materials read the selected paint when mounting. Browser refresh resets cash to 0, clears history/missions and restores factory colors/original vehicle spawns. Existing character localStorage persistence is unchanged and verified after reload. Nothing claims Phase 5.3 persistence is implemented.

## 10. Existing gameplay compatibility

Both accepted mission implementations and checkpoint logic remain intact. First Contact still unlocks Shakedown. Garage bay geometry, drive-in/exit detection, exclusivity and recovery invalidation remain; paid-service checks reuse that detector rather than substituting another parking authority.

No changes to vehicle handling, speed limits, physics, recovery, signals, cameras, NPC models/dialogue, ambient routes/populations, streets/buildings/props or the shared E coordinator. Tests preserve vehicle switching, input priority, parking status and both completed mission histories after purchases.

## 11. Performance and cleanup

No per-frame economy processing, geometry rebuilding or React currency loop. Balance/ledger update only on successful discrete actions; paint listeners update one existing material. The private body slots replace the previous common playable-body material, adding two used body-material instances across three cars, with no additional body meshes/draw calls, geometry or lights. Confirmation reuses cached chassis query shapes.

Scene counts remain **47 rigid bodies / 565 colliders**, with three player cars, two ambient cars and three ambient pedestrians. Browser checks verified no new geometry allocation during respray. Mounted tests verify private-material disposal, empty render-slot references on fleet removal, paint restoration without transactions, garage resource cleanup and stable callbacks/listeners. SwiftShader is not a hardware FPS measurement.

## 12. Automated validation

- `bun run lint`: PASS, exit 0.
- `bun run typecheck`: PASS, exit 0.
- `bun run build`: PASS, exit 0.
- `bun run verify:all`: PASS, exit 0 — **1,054 passing cases/groups** (1,023 previous + 20 mounted + 11 focused).
- `git diff --check`: PASS.

Saved outputs: [full suite](phase52/verify-all.log), [lint](phase52/lint.log), [TypeScript](phase52/typecheck.log), [production build](phase52/build.log).

All previous 1,023 cases/groups are retained. Authorized material-contract assertions now expect private body paint and three remaining shared material slots; common-glass survival and exact disposal counts are still checked. New coverage adds **11 focused economy groups** and **20 mounted integration checks**. It includes integer ledger rejection/idempotency, actual completion credits, real-Rapier parking for all three models, isolated material changes, stale/recovered parking rejection, input/context guards, exact debit, funds exhaustion and remount cleanup.

Production app bundle: **193.59 kB minified / 66.17 kB gzip**. The existing 2,058.37 kB Rapier chunk warning remains.

## 13. Browser verification

**Full desktop journey: 37 checks passed**, Chromium/WebGL at 1280×800. Started at 0 SC; physically completed First Contact for 150 SC, then drove all three Shakedown checkpoints and reported to Marcus for a 450 SC total. Physically drove the original Coupe into a garage bay, exited, walked to the terminal, cancelled a review without spending, then double-clicked explicit confirmation: exactly one 125 SC charge, **325 SC**, and an actual Ember Red body material.

The harness inspected the actual rendered player/ambient body colors and attributes: other player colors and both ambient paints stayed unchanged, with no new geometry allocation. Same-color purchase was rejected. Two more actual color changes left 75 SC; an insufficient-funds attempt preserved cash, history and paint. The resprayed Coupe drove normally, parking cleared on departure, and both missions remained completed. No player/vehicle teleport, velocity forcing, direct mission-state mutation or cash injection was used for this full journey.

See [desktop results](phase52/browser-results.json), [First Contact reward](phase52/first-contact-reward.png), [Shakedown reward](phase52/shakedown-reward.png), [first respray / 325 SC](phase52/paid-respray-325-sc.png), [insufficient funds](phase52/insufficient-funds.png) and [actual resprayed vehicle](phase52/resprayed-driving.png).

**Mobile/UI fixture: 17 checks passed**, 375×812. Mission prerequisites use synthetic validated transition events, and initial player/car setup uses pose fixtures; these are not claimed as a second physical mission journey. Real input drives the car from outside a bay to earn parking proof, then the player is positioned at the terminal for UI checks. Coverage includes zero balance, responsive service layout, focus/review/cancel/Escape, double click, actual body material, Tab loops, insufficient funds, night/debug controls, counts and refresh. Reload reset cash/ledger/selections/actual body paint and mission state while preserving the character.

See [mobile results](phase52/mobile-results.json), [success](phase52/mobile-respray-success.png), [rejection](phase52/mobile-insufficient-funds.png) and [night cash HUD](phase52/mobile-cash-hud-night.png).

Both successful runs observed no game JavaScript exception or shader error. The existing favicon.ico HTTP 404 is recorded separately. Early harness issues (duplicate Vite import identity and mobile stopping position) and an overlapping third-car test setup were corrected without altering gameplay, roads or colliders. Screenshots were visually inspected. Owner manual acceptance is pending.

## 14. Known limitations

- Entire economy and cosmetics reset on refresh; no persistence backend.
- Fictional local game state is inspectable/editable in developer tools; no tamper-proof or redeemable-value claim.
- Full physical browser respray uses the Coupe. All three types receive real-Rapier parking and mounted 3D material-change tests.
- Existing favicon 404, large Rapier chunk warning and old Phase 4.1 HUD subtitle remain.
- No hardware FPS target or owner manual acceptance is claimed.

## 15. Owner manual acceptance checklist

- [ ] New game session shows 0 SC.
- [ ] Complete First Contact normally: 150 SC, one EARN entry and correct brief feedback.
- [ ] Complete Shakedown normally: 450 SC total, a second EARN entry.
- [ ] Reopen normal NPC dialogue; verify no duplicate reward or mission replay.
- [ ] Drive each playable model into a marked garage bay, stop and exit.
- [ ] Confirm unparked/ambient/recovered vehicles cannot receive a paid respray.
- [ ] Inspect factory/current/new colors and price; cancel a review without spending.
- [ ] Confirm a different color: one 125 SC debit, 325 SC after the first purchase, actual painted body.
- [ ] Check wheels, glass, trim, lights, other player cars and ambient traffic remain unchanged.
- [ ] Double-click confirmation and request the current color; verify no duplicate debit.
- [ ] After three valid changes, verify a fourth is rejected at 75 SC without paint/history changes.
- [ ] Drive/switch/recover normally; check parking, cameras, HUD, day/night and F/P/C/Shift+T.
- [ ] Refresh: cash/history/missions/paint reset; saved character remains.

## 16. Git safety

Final branch/HEAD remain `main` / `6c8e969`; local identity remains `helmyfaisal02 <hijautua39@gmail.com>`. Twelve tracked files are modified; twelve new source/test files plus this report/evidence are untracked. The index is empty. All Phase 5.2 changes remain unstaged. No Git configuration/identity/authentication changes, staging, commits, pushes, deployments, token/key access or blockchain actions. Stop after Phase 5.2; Phase 5.3 is not started.
