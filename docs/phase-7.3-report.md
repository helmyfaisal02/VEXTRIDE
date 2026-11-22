# Phase 7.3 — Security, reliability and release QA

## Starting point

`main` started clean at `e40e31a` (Phase 7.2), aligned with `origin/main`. The local identity was `helmyfaisal02 <hijautua39@gmail.com>`. Baseline lint, TypeScript, build and all 1,101 regression checks passed. The code and [Phase 7.2 report](phase-7.2-report.md) were reviewed before edits.

## Trust boundaries

| Source | Handling and residual trust |
| --- | --- |
| Build configuration | The game fixes Arc Mainnet at chain 5042 and uses its configured USDC address and HTTPS explorer. The production scripts contain these public values. |
| Form input and UI events | Recipient and amount are untrusted until validated. The submitted intent comes from explicit in-app review and is checked against the active wallet, network, balance, simulation and fee before wallet consent. |
| Injected EIP-1193 provider | Account and chain responses may change or arrive late. Explicit actions and revisions constrain how they affect the UI. The extension retains responsibility for consent and signing. |
| Arc RPC | RPC data is checked for chain and exact transfer consistency. Those checks still rely on the configured HTTPS RPC for truthful blockchain data. |
| LocalStorage | Guest, character and transfer records use separate keys. The guest schema and economy history are validated before hydration. Street Cash is fictional, browser-local data. Outgoing history stores public transaction details and is scoped in the UI by account and chain. The browser profile and same-origin code can still access its data. |
| Shares, Studio diagnostics and dependencies | The existing share navigation retains Studio origin targeting and excludes fragments. Wallet state and transfer inputs never enter game share URLs. Diagnostics and shipped dependencies are assessed separately from optional tooling and the lockfile. |

## Confirmed findings and fixes

| Severity | Before | Correction and evidence |
| --- | --- | --- |
| Medium | Guest saves trusted the arrival of a storage event. In a regression fixture, another revision was already on disk while the event remained undelivered. The stale tab’s flush returned `true` and replaced that revision. Reset could also remove a changed record, and a tab-wide storage clear was ignored. | Save and reset compare the stored bytes with the last known revision inside a Web Lock when supported. A detected mismatch freezes writes and reset until reload. The fallback compares immediately before writing. Tests now preserve the newer revision before event delivery, protect the same data from reset, and keep cleared data deleted. A production browser test exercised two tabs and reload. |
| Medium, development preview | Arc Studio diagnostics exported raw HTTP bodies, console details and provider activity to the embedding origin. A standalone dev test showed the wallet request function replaced and one unsolicited provider subscription before Connect. | Diagnostics run for framed Arc Studio origins only. HTTP traces include method category, request status and duration, without payloads, paths or queries. Arc RPC is omitted. Console capture forwards bounded error and warning categories, with details kept in the browser console. The dev test now observes the original request function and zero unsolicited subscriptions. |
| Low | A provider request that never settled left the Connect state busy indefinitely. A short-deadline mock stayed `connecting` before the fix. | The connection reports a timeout after 30 seconds and ignores late approval. A pending extension prompt retains its duplicate guard until settlement. A delayed network switch also shows a status message. Listener cleanup attempts every registered event even if an inconsistent provider throws during removal. The focused mock confirms one request, no connection from the late response and no listeners left behind. |

The guest save schema and keys are compatible with older records. Guest reset confirmation identifies the Street Cash ledger separately from the Arc journal and character record. Local storage failures retain the last available snapshot and report the failure. The existing validation suite also covers unsupported versions, malformed JSON, interrupted writes, invalid mission stages, duplicate or forged rewards, unsafe transforms, parking conflicts and replay protection.

## Transfer and recovery review

The Phase 6 submission path uses bigint and six-decimal ERC-20 amounts, with separate eighteen-decimal native fee calculations. Review validates the recipient, chain, balance, affordability and simulation. A higher fee requires renewed in-app review. The journal reserves the operation under a Web Lock before explicit wallet approval. Failure, ambiguous outcome, refresh and reconnect do not trigger automatic resubmission. The release browser tests intercept every wallet and Arc RPC response related to submissions.

Verified success requires matching transaction and receipt hashes, block and position, sender, USDC destination, exact transfer calldata, zero native transfer value and the expected transfer event with exact sender, recipient and amount. The implementation deduplicates identical log indexes and rejects ambiguity, wrong-chain evidence and replacement mismatches. A successful receipt by itself does not qualify. Arc documents one unified six-decimal USDC event for both representations. [Arc event indexing](https://docs.arc.io/integrate/infrastructure/indexing-events)

The history and recovery rules remain account- and chain-scoped. A missing receipt stays pending for the existing tracking interval, and RPC failures remain retryable through read-only checks. An unknown hashless submission stays unresolved without matching mined evidence. Read-only hash lookup leaves other transactions out of the user’s journal. A verified result remains distinct from a locally saved result.

**Live read-only check.** The configured RPC returned `0x13b2` and the existing public receipt used in Phase 6.3 at block 32,411,351. The receipt succeeded and contained zero USDC Transfer events at the configured emitter. This sample proves no VEXTRIDE payment. No live signing, approval, submission or deployment occurred. [Previous public fixture](phase-6.3-report.md#browser-and-live-read-only-evidence)

## Privacy, dependency and build review

- The game reads no `VITE_*` secrets in its source. The audit did not inspect or print secret values, and added no secret-bearing files. Local tests use synthetic sender and recipient addresses and canned hashes. The production output contains no source-map files or Studio trace/console relay message types. Secure explorer links retain HTTPS and `noopener noreferrer`.
- Bun’s registry audit returned 37 advisory entries across eight package names, including 16 high, 15 moderate and six low. None of the eight names appeared among rendered modules in a separate production Rollup module inventory. The affected lockfile paths are under optional or legacy dependency chains that are still installed, including Circle SDK/Firebase and WalletConnect tooling. The browser reachability result does not assess using those tools separately. No dependency was upgraded.
- Lockfile advisories include high entries for `@grpc/grpc-js`, `decode-uri-component`, `toml`, `undici` and `zod`, moderate entries for `stream-json` and `uuid`, and a low entry for `elliptic`. Match future package changes against the lockfile audit before making optional tooling part of the browser or a production server. [gRPC advisory](https://github.com/advisories/GHSA-m9gg-hp2v-232j) · [Undici advisory](https://github.com/advisories/GHSA-2m5v-pch6-74hx)
- The production preview confirmed that the wallet chunk downloads on first open. An intercepted wallet-chunk failure kept the world and Escape dismissal usable. Three.js and Rapier chunk sizes matched the baseline. Gzipped entry JavaScript went from 72.90 to 73.17 kB and wallet JavaScript from 92.34 to 92.47 kB. The existing Rapier size warning remains. The Vite dev server still has the starter’s permissive Host/CORS settings for Studio preview. The QA servers bound to loopback. The audit did not exercise real deployment headers or an externally exposed dev server.

## Release QA matrix

`Regression` means the checked-in automated suites, including Rapier simulations. `Chromium` means a headless SwiftShader browser test of the actual UI. Repositioning and local save snapshots were used for some focused browser scenarios.

| Flow | Evidence |
| --- | --- |
| A–C · Fresh guest, creator/save, walking/sprint/jump | Chromium fresh guest, creator save and reload, walk/sprint. Regression covers jump, held keys and focus. |
| D–E · All three vehicles, cameras, recovery | Regression drives all three and tests camera and recovery. Chromium drove, braked and exited a Coupe and exercised the accepted HUD and camera. |
| F–I · Marcus/Maya, both missions, reward integrity | Chromium opened Maya dialogue. Regression completes both missions with NPC, route and reward checks. Full mission journeys were not replayed from start to finish in the browser for this phase. |
| J–M · Parking, departure, respray, save/reopen, corruption | Regression covers physical parking/departure, paid respray, replay protection and restore. Chromium completed a paid respray from a parked save fixture and verified conflicting tabs, reload and recovery from malformed JSON while retaining character appearance. |
| N–Q · Wallet, network, balance, review/rejection | Desktop and mobile production Chromium tested optional lazy loading, exact review and consent gating, RPC outage and restoration, and mocked rejection. Regression covers wrong-chain checks, account changes and delayed/ambiguous requests. |
| R–T · Pending/confirmed/reverted, recovery and public hash inspection | Production Chromium tested all three mocked states, duplicate clicks, a same-account two-tab submission race, history persistence and no wallet request on reload. The race produced one mocked submission and one journal record. Automated verification covers forged evidence and hashless/replacement recovery. Public hash inspection made read-only calls and is recorded above. |
| U–V · Keyboard/responsive UI, lighting, traffic and pedestrians | Production Chromium at 1280 × 720 and 390 × 844 checked focus, Escape and panel width. Development Chromium exercised lighting and the Downtown road. Regression covers NPC/ambient behaviors, lighting, input isolation and context teardown. |

### Evidence and resource counts

- [Production browser harness](phase73/browser-check.mjs) · [Guest save conflict](phase73/evidence/guest-save-conflict-1280.jpg) · [Desktop mocked verification](phase73/evidence/mock-confirmed-1280.jpg) · [Mobile mocked revert](phase73/evidence/mock-reverted-390.jpg) · [Mobile mocked rejection](phase73/evidence/mock-rejected-390.jpg)
- [Downtown daylight](phase73/evidence/storefront-close-day.jpg) · [Downtown night](phase73/evidence/storefront-close-night.jpg). The 21-view road harness found zero differing pixels in sampled Downtown road regions when comparing the finite grid with the grid hidden.
- Baseline and release measurements both had 47 bodies, 565 colliders and 22 frame callbacks while mounted. Two unmounts reached zero for all three and disposed three owned tree geometries and two owned tree materials each time. The next mounts recovered the same counts. The standalone browser probe measured 29 window listeners at baseline and 25 after the diagnostics changes. The wallet mock showed zero session listeners after disconnect. A sustained browser run exercised about 52 seconds of active input, then induced and restored a WebGL context loss with the same physics and frame counts. No uncaught runtime or shader errors were observed. SwiftShader data does not represent hardware FPS.

## Checks and release limits

- `bun run lint`, `bun run typecheck`, `bun run build` and `bun run verify:all` passed. The suite reported 1,107 cases/groups, preserving all 1,101 from the baseline.
- The report is scoped to this repository, these browser versions and these fixtures. Owner acceptance, independent security review, a real extension approval and a real-money transfer remain unverified.
- Web Locks serialize cooperating tabs. Older browsers without locks fall back to a compare-before-write check, which cannot make competing writes atomic. A snapshot still queued when the browser terminates may be lost. Reload resumes from the last confirmed write.
- A provider that never settles an extension prompt keeps the duplicate guard active for that page. Resolve the prompt in the extension. Public lookup and blockchain confirmation continue to rely on the configured RPC. Verification alone cannot recover a missing transaction hash.

## Changed files

| Area | Files |
| --- | --- |
| Guest persistence | `src/game/persistence/persistenceCoordinator.ts`, `src/game/persistence/persistenceRuntime.ts`, `src/game/hud/GuestProgressSettings.tsx` |
| Wallet timeout and lifecycle | `src/game/blockchain/walletSession.ts`, `src/game/blockchain/ArcWalletContent.tsx` |
| Studio privacy | `src/tracing.ts`, `src/console-capture.ts`, `src/lib/share.ts`, new `src/lib/studioDiagnostics.ts` |
| Verification | `package.json`, `scripts/verify-persistence.ts`, `scripts/verify-wallet.ts`, new `scripts/verify-privacy.ts`, this report and `docs/phase73/` |

## Owner acceptance checklist

1. Start a guest session, save a character and reload. Confirm that the same appearance and name are restored.
2. Walk, sprint and jump, then check all three cars for normal handling, camera and recovery.
3. Speak to Marcus and Maya and complete both missions. Confirm that each Street Cash reward appears once.
4. Park a vehicle, purchase one respray, depart, and reload. Confirm ledger, paint, and occupancy reflect the actions.
5. Open two tabs on the same browser origin. Change progress in one tab. Confirm the other tab warns and requires reload before it can write or reset.
6. In a disposable profile, load a malformed or unsupported guest snapshot. Confirm no crash, no overwrite, and separate character retention.
7. Open Arc Wallet without a wallet installed. Close it and confirm focus and movement return.
8. Use a mock provider to test connection timeout, rejected connection, wrong network, account changes and disconnect. Confirm balances and listener state follow the active account.
9. Using mocked RPC only, interrupt and restore a balance read. Verify that the game continues and displays an unavailable balance during the outage.
10. Use mocked consent to check exact amount, fee re-review, duplicate activation, rejection, pending, verified and reverted outcomes.
11. Reload with mocked Pending or Unknown history. Confirm the record remains visible and no consent request repeats. Verify a public hash read remains separate from personal history.
12. Check the Downtown bakery and bookstore streets by day and night. Check HUD readability, dialog focus, blocked wallet loading and continued world controls.

The branch remains `main` at `e40e31a`. All Phase 7.3 changes are unstaged.
