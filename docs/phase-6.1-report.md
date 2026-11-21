# VEXTRIDE Phase 6.1 — Arc Mainnet and Wallet Foundation

## Repository and implementation

The working tree started clean on `main`, tracking `origin/main`, at `6733753` (`feat: complete VEXTRIDE phase 5 guest persistence`). The local identity matched `helmyfaisal02 <hijautua39@gmail.com>`. The baseline passed 1,074 cases and groups. AGENTS.md, the Arc Studio bootstrap and tracing, the inactive starter wagmi configuration, the HUD, input, character creation, garage, economy and guest-save paths were inspected before editing.

- New `src/game/blockchain/arcConfig.ts` defines the network and validates chain IDs.
- New `src/game/blockchain/usdcBalance.ts` implements the Viem reader and exact bigint formatting.
- New `src/game/blockchain/walletProvider.ts` defines the injected provider interface and bounded account/network inspection.
- New `src/game/blockchain/walletSession.ts` manages the in-memory Zustand session and cleans up provider events.
- New `src/game/blockchain/ArcWallet.tsx` and `ArcWalletContent.tsx` provide the modal and lazily loaded wallet controls.
- `src/game/hud/Hud.tsx`, `WorldTimeHud.tsx`, `src/game/input/inputState.ts`, `useKeyboardInput.ts`, `src/game/interactions/interactionCoordinator.ts` and `src/game/character/useCharacterController.ts` integrate the button and input lock.
- `src/tracing.ts` skips Mainnet wallet RPC payloads and injected account/switch traces so the development tracer does not collect wallet addresses or raw errors. `src/main.tsx` updates the wallet bootstrap comment. Arc Studio share synchronization stays in its existing position.
- `scripts/verify-wallet.ts` and `package.json` add focused checks to `verify:all`. The report and browser evidence are in `docs/`. The existing Viem and Zustand dependencies cover this work.

## Network and balance

| Setting | Value |
|---|---|
| Network | Arc Mainnet |
| Chain ID | 5042 / `0x13b2` |
| Public RPC | `https://rpc.mainnet.arc.io` |
| Explorer | `https://explorer.arc.io` |
| Native USDC accounting | 18 decimals |
| USDC ERC-20 interface | `0x3600000000000000000000000000000000000000` |
| ERC-20 display precision | 6 decimals |

Sources are [Arc RPC endpoints](https://docs.arc.io/arc/references/rpc-endpoints) and [Arc contract addresses](https://docs.arc.io/arc/references/contract-addresses).

The reader validates the wallet address, checks `eth_chainId` at the configured public endpoint and calls `balanceOf` with `eth_call`. It formats the returned bigint directly as six-decimal units. A successful zero displays as `0 USDC`. A failed or timed-out read clears the displayed number and reports RPC unavailability. The native and ERC-20 interfaces share one balance. The reader uses only the ERC-20 view.

## Session, UI and gameplay integration

The Arc Wallet button is available in free walking mode. Its accessible native modal traps focus, blocks gameplay input, and restores focus and movement on Close or Escape. The first browser run exposed a timing gap between native dialog dismissal and input unlock. Both dismissal routes now release the lock synchronously, and immediate walking after Escape passed the rerun.

Connect Wallet is the only action that requests account access. While connected, the panel shows an abbreviated address, deliberate full-address copy, the verified wallet chain, refresh, and application disconnect. The connection is memory-only and stays active when the panel closes. A refresh of the browser starts disconnected. Browser extension permissions may remain authorized after application disconnect.

On the wrong network the panel displays the current chain and expected Arc Mainnet ID and skips the balance read. The explicit switch button requests only chain `0x13b2`. Refusal, an unrecognized chain and unsupported switching are handled with separate messages. Unknown chains can be added manually in the wallet. The app does not issue an automatic add or switch request.

Account and chain events immediately clear the previous address context and balance while the provider is rechecked. Provider disconnect clears session state and removes the three app-owned listeners. A revision guard drops obsolete async results. Concurrent refreshes and wallet prompts are deduplicated. There is no polling. The lazy wallet bundle is fetched when the panel first opens. The previously installed Arc Studio development tracer retains its own chain listener.

Wallet state remains outside Street Cash, progression, parking, character storage and share URLs. First Contact still awards 150 SC, Shakedown awards 300 SC, and a garage respray costs 125 SC. Browser checks recorded the same 47 bodies and 565 colliders as Phase 5.3. No hardware FPS was measured.

## Verification results

| Command | Result |
|---|---|
| `bun run lint` | Passed |
| `bun run typecheck` | Passed |
| `bun run build` | Passed |
| `bun run verify:all` | Passed all 1,082 cases and groups, including the 1,074 baseline and eight new wallet groups |

Logs are available for [lint](phase61/lint.log), [typecheck](phase61/typecheck.log), [build](phase61/build.log), and [regressions](phase61/verify-all.log). The final build emits a 211.50 kB game entry and a separate 274.95 kB wallet module. The guest startup check confirmed the latter is fetched on opening the panel.

## Browser and live evidence

Chromium with SwiftShader passed six groups. The guest run exercised real walking into and out of the modal, initial focus and Escape. The 375 × 812 browser fixture covered rejected connection, wrong-network detection, denied and unknown-chain switching, successful switching, manual copy, account and chain changes, zero balance, RPC failure and refresh, and listener cleanup. Screenshots and runner results are attached. [Mobile connected](phase61/mock-connected-mobile.png) · [Mobile wrong network](phase61/mock-wrong-network-mobile.png) · [Browser results](phase61/browser-results.json)

A separate check against the production build started the WebGL game as a guest, confirmed that the wallet bundle loaded only when requested, and verified focus restoration via Close.

A separate fixture used the earned Phase 5.3 snapshot. It retained 325 SC, three ledger entries, both completed missions, the Coupe’s Ember Red paint, and Bay 1 parking. The browser moved the pedestrian to the service terminal and Maya for the E interaction checks. These were compatibility tests, with full mission and vehicle trajectories covered by the existing regression suite and the previously accepted phase.

The actual Mainnet RPC returned `0x13b2`, `decimals() = 6`, and a zero-filled `balanceOf` response for the public zero address. The production reader returned `0 USDC` in Bun. A separate browser smoke used an injected mock for the address and the actual live RPC for both HTTP 200 calls. The browser screenshots showing 1.234567 USDC use a controlled RPC response. Live extension consent remains for owner acceptance.

No runtime or shader errors were observed. The browser logged the existing favicon 404 and the intentionally aborted mock RPC request. The build kept the existing Rapier vendor chunk size warning. Injected support requires an event-capable provider exposed as `window.ethereum`. Browser clipboard access and public RPC availability can vary.

## Manual acceptance checkpoints

1. Start the game as a guest and verify walking and character creation are available before connecting.
2. Open Arc Wallet without an extension and verify the missing-wallet message.
3. Open with an extension and confirm it prompts only after Connect Wallet.
4. Reject account access and verify the declined state.
5. Connect on Testnet or another chain and verify the current and expected networks and the absence of a balance.
6. Decline an explicit switch and verify that the wrong-network state stays visible.
7. Select Arc Mainnet, verify the displayed address, then copy and compare the full address.
8. Verify the actual USDC amount against the wallet and use Refresh Balance.
9. Switch accounts and chains in the extension and verify that the old balance clears.
10. Disconnect and verify the game session clears. Reopen the panel and confirm its disconnected state.
11. Check mobile layout, keyboard focus, Escape, and immediate movement after closing.
12. Verify Street Cash, missions, paint, parking and the guest save across wallet actions and a browser reload.

## Git

All changes are unstaged on `main` at `6733753`. No commits, push, deployment, signing or transactions were performed. Phase 6.2 was not started.
