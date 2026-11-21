# VEXTRIDE Phase 6.2 — Arc USDC transfer and confirmation

## Repository and scope

Phase 6.1 was committed at `b55060a` on `main`, tracking `origin/main`. The working tree was clean and local identity matched `helmyfaisal02 <hijautua39@gmail.com>`. Baseline lint and TypeScript passed, along with all 1,082 existing cases and groups.

The Arc Mainnet configuration from Phase 6.1 is reused. Chain ID is 5042, the RPC is `https://rpc.mainnet.arc.io`, and the USDC ERC-20 interface is `0x3600000000000000000000000000000000000000`. Circle documents six-decimal ERC-20 transfers and 18-decimal native gas accounting for the same underlying USDC. [Arc contract addresses](https://docs.arc.io/arc/references/contract-addresses) · [Arc gas and fees](https://docs.arc.io/arc/references/gas-and-fees)

## Files

- New `src/game/blockchain/transferValidation.ts` validates recipient, amount, available funds and transaction hash.
- New `src/game/blockchain/transferRpc.ts` reads and verifies the Arc chain, builds fee quotes, simulates transfers and checks receipts.
- New `src/game/blockchain/transferSession.ts` manages review identity, pending wallet requests, duplicate protection and receipt state.
- New `src/game/blockchain/SendUsdc.tsx` renders the form, review and status in the existing wallet modal.
- Updated `ArcWallet.tsx` and `ArcWalletContent.tsx` for input dismissal, review cancellation and the wallet handoff guard.
- Updated `walletProvider.ts` and `walletSession.ts` for the typed transaction request and a guarded reference to the current injected account.
- Updated `src/tracing.ts` to exclude injected transaction payloads. The existing Arc RPC tracing exclusion covers preflight and receipt requests.
- New `scripts/verify-transfer.ts`, registered in `package.json`. This report and browser evidence are under `docs/`. No dependency changes.

## Transfer flow

The form starts blank and accepts a manually entered EVM address. It checksums the address and rejects the zero address, the connected sender and the USDC contract. It accepts positive decimal strings with up to six decimal places. Invalid formats, exponents, negatives, zero, excess precision and overflow are rejected before a wallet request. The parsed integer is the exact six-decimal `transfer(address,uint256)` argument.

To quote, the app checks the actual injected account and chain, verifies the public RPC chain, and reads ERC-20 and native balances. It calls `transfer` as a simulation, estimates gas and fetches current gas pricing. The estimated gas limit includes a 20% margin. The fee cap multiplies that limit by the suggested price or the Arc minimum of 20 Gwei, whichever is higher. The affordability check compares the six-decimal token balance to the amount, then compares the native balance to the amount multiplied by 10^12 plus the fee cap. It does not sum the two balance views.

The review shows Arc Mainnet, the full sender and recipient, the amount, the estimated fee cap and total estimated debit. Confirmation consumes that exact review and repeats preflight and account/chain checks. A higher fee produces an updated review requiring a new confirmation. Only then does the injected wallet receive one `eth_sendTransaction` request with chain ID 5042, the exact approved ERC-20 calldata, zero native value, and the quoted EIP-1559 caps. The wallet handles the separate approval. A failed simulation or estimate stops the workflow.

## Status and safety

Form edits, panel dismissal and account or chain changes invalidate unsubmitted reviews. The state guard blocks concurrent sends. A wallet refusal reports rejection and requires a new review. An invalid response, transport error or 90-second delay without a hash reports unknown status and keeps the send locked. A later valid hash can still resume tracking. Escape does not dismiss the game panel while wallet confirmation is active.

A valid hash becomes submitted and is checked on the public Arc RPC. A missing receipt is pending, temporary RPC errors can be checked again, and unexpected receipt data requires verification. A confirmed transfer requires a successful receipt on Arc, the matching hash, sender and token contract, and the exact ERC-20 Transfer event. A matching failed receipt reports reverted. The explorer URL uses the official configured host and a validated hash. Arc exposes a unified six-decimal transfer event, which the app checks once for a match. [Arc event indexing](https://docs.arc.io/integrate/infrastructure/indexing-events)

Receipt checks continue on the original chain even if the wallet changes networks. Automatic checks are bounded and tied to the open panel. The app clears the timers on dismissal or unmount and permits a manual read for an unresolved hash. Drafts and wallet status are in memory. A reload loses local tracking, so inspect wallet activity before retrying an ambiguous transfer. Replacement transactions are not discovered by the original hash. A wallet that does not accept the supplied EIP-1559 transaction fields can refuse the request.

Wallet sends never write to the game ledger or guest save. The browser fixture retained both completed missions, the 325 SC balance and its ledger, paint and garage state. The regression suite covers the existing 150 SC and 300 SC mission rewards, 125 SC respray, NPC interactions, vehicle and camera systems. Browser physics counts remained at 47 bodies and 565 colliders. No hardware FPS was measured.

## Validation results

| Command | Result |
| --- | --- |
| `bun run lint` | Passed |
| `bun run typecheck` | Passed |
| `bun run build` | Passed, with the existing Rapier chunk size warning |
| `bun run verify:all` | Passed 1,089 cases and groups, including all 1,082 baseline checks and seven new transfer groups |

[Build log](phase62/build.log) · [Full regression log](phase62/verify-all.log)

## Browser and live RPC evidence

Two Chromium WebGL runs used controlled EIP-1193 and RPC mocks for every submission. Desktop verified wrong-chain blocking, failed simulation, rejected wallet approval, duplicate-click protection, pending tracking across a chain switch and a reverted receipt. The 375 px mobile run verified the review layout, exact calldata, pending-to-confirmed transition and explorer URL. Both verified Escape during handoff, walking and focus after dismissal, and guest save integrity. No runtime or shader errors were observed. [Browser results](phase62/browser.json) · [Mobile review](phase62/mobile-review.png) · [Mobile mock confirmation](phase62/mobile-confirmed.png) · [Desktop mock revert](phase62/desktop-reverted.png)

Live read-only RPC returned `0x13b2`, zero for the public zero address and a successful receipt for an existing public transaction at block 32411351. A zero-value simulation from a synthetic empty address returned true and estimated 38,764 gas units. A separate zero-address sender probe returned the expected contract revert. Those probes were simulations and reads. No real transfer, signing, approval or key access occurred. Live wallet-extension confirmation was not exercised. [Live read output](phase62/live-reads.log)

## Manual acceptance checkpoints

1. Play as a guest and verify that the wallet never prompts without an explicit connection request.
2. Open the wallet on Testnet or another chain and verify the send form is unavailable.
3. Connect an Arc Mainnet mock session and verify the recipient and amount start blank.
4. Reject a malformed, zero, self or USDC contract recipient.
5. Reject zero, negative, exponent notation and more than six decimal places.
6. Check that a balance covering only the transfer amount fails when fees cannot be covered.
7. Review a valid quote, inspect full addresses and exact amounts, then cancel and verify there is no wallet request.
8. Change the amount, account or chain after review and verify that confirmation requires a fresh review.
9. Increase the mock fee after review and verify the higher total needs separate approval.
10. Confirm using a mock extension, double-click Confirm and press Escape. Verify one wallet request and explicit handling of rejection.
11. Use mock pending, confirmed, reverted and unavailable receipts. Verify hash-specific explorer navigation and no automatic retry.
12. Close the panel and verify gameplay input, Street Cash, missions, garage and guest save. Refresh and verify the wallet starts disconnected and session-only tracking clears.

## Git

Phase 6.2 changes are unstaged on `main` at `b55060a`. The local Git identity was preserved. No staging, commit, push or deployment occurred. Phase 6.3 was not started.
