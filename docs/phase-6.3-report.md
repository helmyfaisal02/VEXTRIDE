# VEXTRIDE Phase 6.3 — Arc payment verification and recovery

## Initial repository inspection

The repository started clean on `main`, tracking `origin/main`, at `3f37372` (`feat: add VEXTRIDE Arc USDC transfer flow`). Phase 6.2 was committed. The local identity was `helmyfaisal02 <hijautua39@gmail.com>`. Baseline lint and TypeScript passed, along with all 1,089 existing verification cases and groups. The existing wallet session, preflight, receipt reader, gameplay persistence boundary, and verification scripts were inspected before edits.

The implementation reuses Arc Mainnet (5042), the existing RPC and explorer, and ERC-20 USDC at `0x3600000000000000000000000000000000000000`. Arc's current docs identify the 18-decimal native system emitter and the six-decimal ERC-20 interface as separate views of the same movement. Verification reads the ERC-20 contract event only. It never adds native and ERC-20 balances or counts the native system event as another payment. [Arc event indexing](https://docs.arc.io/integrate/infrastructure/indexing-events) · [Arc contract addresses](https://docs.arc.io/arc/references/contract-addresses)

## Files

- New `src/game/blockchain/transferHistory.ts` provides versioned serialization, validation, storage, account selectors and runtime verification labels.
- New `src/game/blockchain/transferVerification.ts` reads and corroborates the transaction, receipt and USDC logs.
- New `src/game/blockchain/TransferActivity.tsx` provides scoped history, recovery actions, and public hash inspection.
- Updated `src/game/blockchain/transferSession.ts`, `transferRpc.ts`, `transferValidation.ts`, `SendUsdc.tsx` and `ArcWalletContent.tsx` integrate the journal and retain the Phase 6.2 review and wallet handoff.
- Updated `scripts/verify-transfer.ts` to mock transaction and receipt evidence. New `scripts/verify-transfer-history.ts` is registered in `package.json`.
- This report and run evidence are under `docs/`. No dependencies were added.

## Transfer record and storage

The independent localStorage key is `vextride.arc.transfers.v1`. Its envelope contains schema version 1 and plain JSON records. Each record stores a UUID operation ID, Arc chain ID, sender and recipient, raw six-decimal integer amount, a transaction hash when known, status, timestamps, the observed preflight block, and the verified block and log index where applicable. Amounts and blocks serialize as decimal strings. Known hashes are unique within the Arc chain even though the row retains its local operation ID.

Validation rejects unsupported schemas, malformed JSON, invalid addresses, amounts, hashes and chain IDs, inconsistent status and evidence, duplicate IDs and hashes, and conflicting unresolved operations. Original invalid data is preserved. The journal keeps up to 80 records across accounts. It prunes oldest settled entries first and refuses a new reservation when only unresolved entries remain. A storage failure before reservation stops submission. If storage fails after handoff, the in-memory result remains visible and the browser copy may remain unresolved. The UI warns about that failure.

Records contain public addresses and transaction details in the current browser profile. They do not contain signatures or keys, and are separate from gameplay storage and share URLs. Local history is not an authoritative wallet ledger. The UI labels restored outcomes as saved until checked live for the same record.

## Submission and recovery

Phase 6.2 recipient, exact amount, network, affordability, simulation, fee re-review and two-stage confirmation remain in place. Before the injected provider receives a request, VEXTRIDE durably reserves an operation for the sending account. A browser Web Lock protects the reservation and release between tabs. The wallet prompt executes outside the lock after dispatch. The duplicate guard remains active in the page during the handoff. The valid returned hash is journaled immediately and can be checked read-only.

Refresh and profile reopening only restore the records. The user must explicitly reconnect to show that sending account's records. Wrong-network state pauses scoped history checks, while switching to another account hides the previous account's rows. A known hash can resume checks on the correct account and chain. Pending work does not issue a new wallet request.

A refusal records User Rejected. An ambiguous submission or an interrupted hashless reservation remains unresolved. The user can inspect wallet activity and deliberately supply a matching mined hash. The app verifies the original intent, requires a block after the final preflight head, and rejects a hash already recorded elsewhere. This verifies the observed payment intent. A hashless record alone cannot establish whether the original wallet call was submitted. If a suitable hash cannot be recovered, there is no local override to make that operation safe to retry.

## Verification and history UI

The RPC chain is checked before both the transaction and receipt are read. A verification requires the same requested hash, sender, destination, matching block and transaction position, zero native transfer value, and the exact ERC-20 transfer calldata. For success, the receipt must contain exactly one matching ERC-20 event after deduplication. Each relevant event must reference the same transaction and block and have a valid index, sender, recipient and bigint value. Identical repeated log indexes count once. Conflicting indexes or multiple matching distinct logs remain unknown. A matching reverted receipt is shown as reverted. Arc finality is used without an added confirmation-depth delay.

The wallet panel lists dates, amounts, recipients, states, hashes and official explorer links. Hash lookup works read-only without a wallet signature. It reports observable Arc transaction and receipt facts and ERC-20 movements without adding public transactions to history or attributing them to the player. Confirmation of a VEXTRIDE record always uses its saved intent.

A missing receipt stays pending during the initial tracking window and becomes unknown after 30 minutes without a receipt. RPC errors show Verification Unavailable and permit rechecking. A replaced known hash cannot be reliably linked from the original hash alone, so the app keeps it unresolved and directs the user to wallet activity. There is no automatic resend or replacement inference.

## Cleanup and gameplay

The wallet stays lazy-loaded. Recovery uses up to three timed checks per open panel and recoverable record, deduplicates concurrent record checks and stops the timers when the scope changes or the panel closes. The storage listener is mounted only while the panel is open. Stale provider checks lose their account context. Public lookup results are ignored after its UI unmounts. The browser requires Web Locks for transaction reservation, so browsers without this capability can still inspect public hashes but cannot start a transfer through this flow.

Street Cash reward and respray values, mission/garage progress, vehicle paints and guest copies remain independent. Browser verification retained the earned fixture's 325 SC and both completed missions, returned focus and walking on close, and counted 47 physics bodies and 565 colliders. No hardware FPS or owner acceptance is claimed.

## Validation results

| Command | Result |
|---|---|
| `bun run lint` | Passed |
| `bun run typecheck` | Passed |
| `bun run build` | Passed with the existing Rapier chunk size warning |
| `bun run verify:all` | Passed 1,095 cases and groups, including all 1,089 baseline checks and six new history and verification groups |

[Lint](phase63/lint.log) · [TypeScript](phase63/typecheck.log) · [Build](phase63/build.log) · [Regressions](phase63/verify-all.log)

## Browser and live read-only evidence

Chromium WebGL with SwiftShader used isolated test profiles, injected mocks and intercepted RPC for every submission. Desktop covered double-click protection, refresh, pending recovery and account/network isolation. Mobile closed and reopened the same browser profile, recovered a pending record through an RPC outage, checked a matching receipt, then verified hashless recovery without re-submitting. A signed-out public lookup made no wallet requests and preserved the history and guest save. No runtime or shader errors were observed. The logged failed requests came from the intentionally intercepted RPC outage. [Browser results](phase63/browser.json) · [Desktop pending](phase63/desktop-pending.png) · [Mobile mock verification](phase63/mobile-verified.png)

Arc's public RPC returned chain 5042. The previously existing public hash `0xec0a5009a9654dc8c89e968c7f75d2a7df64df1695a7a1df1ab31e3e2aa61446` returned matching transaction and successful receipt at block 32411351 and had no ERC-20 USDC Transfer event. It was therefore a successful EVM receipt only, with no app payment attribution. The sampled public log windows did not yield a direct ERC-20 transfer for an additional live match. No live signing or broadcast occurred. [Live reads](phase63/live-reads.log)

## Manual acceptance checkpoints

1. Start as a guest and open Arc Wallet. Verify that no wallet prompt appears automatically.
2. Inspect an invalid hash and verify that the panel rejects it without an RPC request.
3. Inspect a known public Arc hash without connecting. Verify that the outgoing journal stays unchanged.
4. Reconnect the correct account on Arc Mainnet and verify that only its stored outgoing history appears.
5. Switch account and chain and verify filtering and the pause in scoped rechecks.
6. With a mock wallet, confirm a valid in-app review twice and observe only one wallet request.
7. Reject the wallet request and verify User Rejected with no automatic retry.
8. Return a mock hash, refresh, and close and reopen the browser profile. Verify pending recovery without another send.
9. Fail the receipt RPC temporarily, then restore it and verify status recovery.
10. Compare valid, reverted, mismatched and ambiguous ERC-20 evidence. Only the matching success should show verified confirmation.
11. Keep an ambiguous response hashless, then try to recover it using an unrelated, previously used, and matching post-preflight hash.
12. Close the wallet and verify movement, Street Cash, missions, paint, garage parking and the guest save.

## Git

Phase 6.3 changes remain unstaged on `main` at `3f37372`. Local identity was preserved. No staging, commit, push, deployment or broadcast occurred. Phase 7 was not started.
