# VEXTRIDE Phase 7.4 — Release candidate

**READY FOR OWNER REVIEW. Public release is no-go pending owner authorization and target-host checks.**

## Checkpoint and changes

The clean baseline was `main` at `800bae993a950ef3ea607d632d2ad2b3f6269fea`, matching local `origin/main` and GitHub’s unauthenticated public branch ref. Local Git identity was `helmyfaisal02 <hijautua39@gmail.com>`. Reviewed the repository guidance, Phase [7.1](phase-7.1-report.md), [7.2](phase-7.2-report.md) and [7.3](phase-7.3-report.md), lockfile, build configuration, entry point, routing and legacy contract scripts. Baseline lint, TypeScript, build and **1,107** regression checks passed.

Phase 7.4 adds release documentation, the browser and artifact checks under `docs/phase74/`, and a regression for Arc’s ERC-20 and native companion logs. The Phase 7.1 browser harness now selects presets using the accepted Phase 7.2 fieldset and label. The application source, dependency lockfile, deployment scripts, chain configuration and gameplay are unchanged.

## Build and evidence

| Check | Result |
| --- | --- |
| `bun run lint` | Passed |
| `bun run typecheck` | Passed |
| `bun run build` | Passed with the existing Rapier chunk warning |
| `bun run verify:all` | **1,108 passed**, preserving all 1,107 baseline checks |
| Clean frozen dependency install | Bun 1.3.14, 910 packages installed in a separate clean archive with `--frozen-lockfile --ignore-scripts` |
| Reproducibility | All seven files matched SHA-256 between the fresh archive build and the workspace candidate on this machine |
| Local static delivery | Every artifact returned HTTP 200 with the expected MIME type and bytes, including the optional CCIP chunk. Root and nested SPA navigation returned the same HTML. |

The inspected lockfile SHA-256 is `cca1fa3ce4f4b4ed298578180bb1b9b8926e04cde61f30842d0f24f6d6156c4f`. The verification environment used Bun 1.3.14, Node 22.22.2, Vite 6.4.5, TypeScript 7.0.2 and Chrome 157.0.8103.78. Reproducing this result on a different OS or toolchain remains unverified. The archived checkout and candidate contain identical browser bytes because Phase 7.4 changes are docs and tests only.

| Artifact role | Raw bytes | Gzip bytes |
| --- | ---: | ---: |
| HTML | 1,002 | 502 |
| Entry JS | 213,136 | 73,171 |
| CSS | 23,576 | 5,320 |
| Three.js | 1,014,005 | 282,534 |
| Rapier | 2,058,365 | 761,617 |
| Lazy wallet | 302,007 | 92,472 |
| CCIP | 3,110 | 1,428 |
| Total | 3,615,201 | 1,217,044 |

[Machine-readable artifact inventory and HTTP checks](phase74/evidence/artifacts.json) · [Artifact verifier](phase74/verify-artifacts.mjs)

## Browser QA matrix

The production harness served the built artifact on loopback with no injected module instrumentation beyond test probes and wallet mocks. Phase 7.2, 7.3, lifecycle and road checks used their existing harnesses against the same source checkpoint. Some development-world tests moved the pedestrian near a target or used the earned **325 SC** garage fixture. The full mission routes and all three vehicles were covered by integration and Rapier simulation rather than driven end-to-end in the production browser.

| Scenario | Evidence |
| --- | --- |
| 375 × 812 | Production creator focus, HUD, wallet fit and focus restoration. [Creator](phase74/evidence/creator-375.jpg) · [HUD](phase74/evidence/hud-375.jpg) |
| 390 × 844 | Production HUD, wallet, 150% text sizing, reduced-motion preference and mocked revert/rejection. [HUD](phase74/evidence/hud-390.jpg) · [Large-text wallet](phase74/evidence/wallet-390-large.jpg) · [Revert](phase74/evidence/mock-reverted-390.jpg) · [Rejection](phase74/evidence/mock-rejected-390.jpg) |
| 768 × 1024 | Production HUD, wallet fit, keyboard open and Escape focus restoration. [HUD](phase74/evidence/hud-768.jpg) |
| 1280 × 720 | Production HUD, mocked pending-to-verified receipt, two-tab save conflict and mocked submission deduplication. [HUD](phase74/evidence/hud-1280.jpg) · [Mock verification](phase74/evidence/mock-confirmed-1280.jpg) · [Conflict](phase74/evidence/guest-save-conflict-1280.jpg) |
| 1920 × 1080 | Production HUD, wallet fit, keyboard open and Escape focus restoration. [HUD](phase74/evidence/hud-1920.jpg) |
| Profile and asset lifecycle | Production fresh character, nested navigation, refresh and reopening the same browser profile, guest without a provider, lazy wallet and isolated optional-chunk failure. External Google font resources loaded in this run. |
| Physics and garage | Development Chromium walked, sprinted, drove and exited the Coupe, changed all presets, opened the garage and bought a 125 SC respray from the parked save fixture. Existing automated tests cover Coupe, Sedan and Pickup handling, entry/exit, camera, recovery, signals, parking, reload and all four driveway cuts. |
| Missions and world | Browser tests exercised Maya dialogue and First Contact acceptance and decline. The full automated integration covers both missions, directional checkpoint ordering, 150 SC and 300 SC rewards, Marcus, ambient populations, all six districts, roads, buildings and lighting. |
| Storage and economy | Production two-tab conflict, reload and malformed snapshot tests passed with the character retained. The current schema, reset boundaries, ledger, respray, paint and parking restore passed in automation. |
| Blockchain | Production mocked flows tested duplicate confirmation, same-account tab contention, balance outage and recovery, verified and failed receipts, and journal persistence without auto-connect. The suite covers wrong account/chain, timeouts, stale data, missing/reverted receipts, mismatches and hashless handling. Signed-out public-hash UI inspection used a mocked missing receipt and performed no provider request or journal write. |
| Accessibility | All five production viewport checks passed. Development Chromium exercised creator radio navigation, modal focus, garage review/cancel/reset, mobile controls, NPC dialogue, mission and transfer review. Scoped axe-core 4.10.3 checks returned zero violations in creator, transfer review and garage respray. |
| Runtime | Production resumed rendering after induced WebGL context loss. The development lifecycle retained 47 bodies, 565 colliders and 22 frame callbacks after about 54 seconds of active input, context restoration and two remounts. Detached roots reached zero for those counts, and the tree disposed three owned geometries and two materials per teardown. The one-ray interaction optimisation was rechecked by Rapier integration. |
| Downtown road | The 21-view road harness found zero differing pixels between the finite-grid and hidden-grid passes in sampled Downtown road regions at day and night. [Day](phase74/evidence/storefront-close-day.jpg) · [Night](phase74/evidence/storefront-close-night.jpg) |

The tested runs reported no uncaught runtime or shader errors. SwiftShader measurements do not predict hardware FPS. The mobile layout supports the UI, and gameplay still uses a keyboard and mouse. [Production results](phase74/evidence/preview.json) · [Lifecycle results](phase74/evidence/lifecycle.json) · [Road results](phase74/evidence/roads.json)

## Security, deployment and decision

[Security and dependency review](phase74/security-review.md) documents the 37 current advisory entries, installed transitive paths and potential remediation. None of the eight affected package names appeared in the rendered browser chunks. Legacy build or operator exposure remains a separate concern. The runtime continued using only the configured Arc Mainnet endpoint. The current Arc documentation confirms that direct ERC-20 activity can emit native and ERC-20 records for the same movement. The new test expects one verified ERC-20 record from the existing verified emitter. [Arc event indexing](https://docs.arc.io/integrate/infrastructure/indexing-events)

The live RPC check returned chain **5042**. The existing public sample receipt succeeded with **zero matching ERC-20 events**. The search found no qualifying direct ERC-20 sample among 32 inspected entries. The evidence contains aggregate outcomes only and establishes no VEXTRIDE payment. [Read-only RPC results](phase74/evidence/live-rpc.json)

| Gate | Status |
| --- | --- |
| Release-candidate code and artifact | **Ready for owner review** |
| Hosting and infrastructure | **Conditional**. Actual domain, host headers, routing and cache behavior are unknown. |
| Dedicated contract | **Separate future work**. Purpose, design, security review and manual deployment decisions are outstanding. |
| Real-money VEXTRIDE payment | **Unverified**. Current evidence covers mocks and read-only observations. |
| Public release | **No-go pending owner approval** and the host, risk and payment decisions in the runbook. |

[Deployment readiness, smoke tests, rollback and incident response](phase74/deployment-runbook.md)

## Twelve owner acceptance checkpoints

1. Build from the frozen lockfile and compare the seven artifact fingerprints with the inventory.
2. Open the intended HTTPS host only after separate authorization. Confirm nested refresh, correct MIME, true asset 404s and the host’s security/cache headers.
3. Start a fresh guest, choose a preset, save and reopen. Confirm character and guest progress persist on the same origin.
4. Walk, sprint and jump. Drive all three vehicles and verify cameras, braking, recovery and garage driveways.
5. Speak with Marcus and Maya, complete First Contact and Shakedown, and verify all three ordered checkpoints and one reward per mission.
6. Park in the two-bay garage, complete a 125 SC respray, leave and reload. Check occupancy, balance, paint and ledger.
7. In disposable profiles, test corrupt save recovery, guest reset, and two-tab conflict behavior.
8. Verify all five viewports, 150% text scaling, reduced motion, modal focus containment, Escape restoration and input isolation.
9. Play with the wallet disconnected. Open it with a mock provider and check lazy load, wrong network, timeout, outage recovery and no auto-connect.
10. Use only mocks to test exact amounts, fee review, single submission, tab contention, rejection, pending, reverted and verified history.
11. Reload pending and unknown records and check read-only lookup. Confirm it leaves personal history unchanged and requests no consent.
12. Inspect Downtown by day and night, try WebGL/wallet-chunk recovery, and verify the previous artifact and rollback instructions are available.

The branch remains `main` at `800bae9`. Phase 7.4 changes are unstaged. Owner acceptance and public authorization remain pending.
