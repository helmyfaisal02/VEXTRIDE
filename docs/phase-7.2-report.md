# Phase 7.2 — UX, accessibility and responsive polish

## Starting point and reproduced issues

`main` started clean at `fd816bc` (Phase 7.1 and the Downtown road fix), aligned with `origin/main`. The repository-local identity is `helmyfaisal02 <hijautua39@gmail.com>`. Baseline lint, TypeScript and production build passed, and the suite reported 1,098 passing checks.

- At 390 × 844, the desktop help legend occupied x=20–239 and y=620–824 while the speedometer occupied x=98–293 and y=650–820. Their rectangles overlapped. The fixed Arc Studio badge covered the bottom of both.
- Character Creator left initial focus on the document body. After reopening and dismissing with Escape, focus returned to the body instead of Edit Character. Its preset cards exposed radio semantics without native arrow navigation.
- Source inspection showed that the garage’s respray and guest-reset reviews focused the destructive or paid action first. Escape dismissed the whole garage instead of cancelling the focused review. Arc Wallet already restored focus to its launcher at every tested size.
- Source inspection showed that the transfer form reported a rejected draft separately from its controls. The review appeared below the form without moving keyboard focus to the details.
- At 150% root text size the wallet needed vertical scrolling. Its header and Close control moved out of sight on long views.

## Changes

- The HUD stacks the world clock, Street Cash and mission on the left and places character, wallet and debug information in a separate column. On the three narrower viewports, the expandable Controls legend sits above the gameplay HUD and above the Studio badge. The 1280 and 1920 layouts retain the full legend on the left. The speedometer and in-world interaction hints remain visible in their own space.
- The Character Creator, NPC dialogue and garage share focus containment. Creator opens on its heading, uses native preset radio buttons with arrow navigation, and returns focus to Edit Character after editing. Opening/closing overlays clears held gameplay input. Space activates a focused HUD button or Controls summary. Clicking the scene or pressing a gameplay movement key returns keyboard control to the world. F, P, C and Shift+T are gated while a modal owns input.
- The garage and wallet keep Close visible while content scrolls. The garage uses existing real parking and respray eligibility. Respray and reset reviews start on Cancel. Escape in a review cancels that review and returns focus to its opener.
- The Arc Wallet keeps its native dialog and optional loading. A draft error is associated with the recipient and amount fields. A successful preflight focuses the review heading, and Cancel returns focus to Review Transfer. The review shows the full recipient, exact USDC amount, fee cap and separate wallet approval warning. Transfer activity uses one panel scroll area, keeps long hashes wrappable, and reserves the verified success color for verified records.
- Gameplay, mission, garage, persistence and blockchain services use their existing state and rules. The source diff leaves roads, world rendering, physics, payment encoding, preflight, receipt verification and share synchronization alone.

### Changed files

| Area | Files |
| --- | --- |
| HUD layout and styling | `src/index.css`, `src/main.tsx`, `src/game/hud/{Hud,EconomyHud,MissionHud,VehicleHud,WorldTimeHud}.tsx` |
| Modal and interaction UI | `src/game/hud/{CharacterCreator,NPCDialogue,GaragePanel,GarageRespray,GuestProgressSettings}.tsx`, new `src/game/hud/useModalFocus.ts` |
| Keyboard gating | `src/game/input/useKeyboardInput.ts`, new `src/game/input/gameplayUi.ts` |
| Wallet UI | `src/game/blockchain/{ArcWallet,ArcWalletContent,SendUsdc,TransferActivity}.tsx` |
| Verification and evidence | `scripts/verify-input.tsx`, `docs/phase72/browser-check.mjs`, this report, and the screenshots under `docs/phase72/evidence/` |

## Browser evidence

Chrome 157.0.8103.78 used headless SwiftShader. The browser tested all five requested sizes, 150% root text sizing, reduced-motion preference, keyboard tab order, focus indicators and Escape. It entered and exited an actual Rapier vehicle, checked typing safety using a test-only field, opened the real garage through E, cancelled respray and reset, and exercised Maya’s First Contact offer, decline and acceptance. A guest-save fixture supplied the earned 325 SC balance and garage parking for the UI checks. The test placed the pedestrian near targets to isolate these UI journeys.

All wallet interaction used an injected test provider and mocked Arc RPC responses. The checks covered guest play without a prompt, explicit connection, a wrong-chain transition, recipient error description, exact six-decimal review, Cancel/Confirm keyboard order, and mobile Pending, Unknown and saved/verified confirmation presentation. There was no signing or submission. The browser run reported no page or shader errors. A separate production preview booted without a wallet and fetched the wallet chunk only after the user opened the panel. Axe 4.10.3 found zero violations under the selected AA-tagged rules in scoped scans of the creator, transfer review and garage respray. The scans do not establish conformance across the full game or substitute for screen-reader testing.

| Evidence | Before | After |
| --- | --- | --- |
| Driving, 390 × 844 | [Help covered the speedometer](phase72/evidence/before-driving-390.jpg) | [Separate legend and speedometer](phase72/evidence/after-driving-390.jpg) · [Night driving](phase72/evidence/after-driving-night-390.jpg) |
| Creator, 375 × 812 | [Baseline creator](phase72/evidence/before-creator-375.jpg) | [Initial heading focus](phase72/evidence/after-creator-375.jpg) |
| HUD, 1920 × 1080 | [Baseline desktop](phase72/evidence/before-hud-1920.jpg) | [Desktop HUD](phase72/evidence/after-hud-1920.jpg) |
| Wallet, 390 × 844 | [Baseline wallet](phase72/evidence/before-wallet-390.jpg) | [Wallet](phase72/evidence/after-wallet-390.jpg) · [150% text review](phase72/evidence/after-wallet-review-large.jpg) · [Mocked verified history](phase72/evidence/after-history-verified-375.jpg) |

Additional screenshots show the [375 px HUD](phase72/evidence/after-hud-375.jpg), [768 px HUD](phase72/evidence/after-hud-768.jpg), [1280 px HUD](phase72/evidence/after-hud-1280.jpg), [garage confirmation](phase72/evidence/after-garage-confirm-390.jpg), [nighttime mission objective](phase72/evidence/after-mission-night-390.jpg), and [Downtown road at 2:27 AM](phase72/evidence/after-downtown-night.jpg).

## Road hotfix and runtime impact

The existing road harness captured 21 WebGL views per run, including Downtown day and night, four driveway cuts, residential and plaza roads, and a moving Coupe. At the reported nighttime storefront view both runs measured 132 draw calls, 28,682 triangles, 898 road triangles and 2,784 marking triangles. The finite grid changed zero pixels against the hidden-grid sample over the Downtown street, both on the main road and near the storefronts. The browser matched 47 bodies, 565 colliders and 22 frame callbacks before and after. The UI journey also retained 276 distinct referenced scene geometries before and after opening the creator, garage and wallet.

The new layout is CSS-driven. It adds no frame callback, physics body, polling task or global listener. Vite preserved the lazy wallet split. Gzipped entry JavaScript grew from 72.39 to 72.90 kB, wallet JavaScript from 92.05 to 92.34 kB and CSS from 4.71 to 5.32 kB. The Three.js and Rapier chunks matched the baseline sizes. The existing large Rapier chunk warning still appears. SwiftShader measurements do not represent hardware FPS.

## Validation and limits

- `bun run lint` passed.
- `bun run typecheck` passed.
- `bun run build` passed with the existing Rapier chunk warning.
- `bun run verify:all` passed with 1,101 checks, including all 1,098 baseline checks and three new keyboard-input checks.
- [Repeatable Chromium verification](phase72/browser-check.mjs) runs against the local Vite dev server. Set `VEXTRIDE_PLAYWRIGHT_MODULE` and `VEXTRIDE_CHROMIUM` if Playwright and Chromium are outside the project. Optionally set `VEXTRIDE_AXE_SCRIPT` to a local axe-core browser script.
- The responsive checks cover UI only. Gameplay still uses a keyboard and mouse. Native browser zoom, Safari, Firefox, assistive-technology behavior and real wallet-extension handoff were outside this browser run. The complete mission and purchase journeys are covered by the existing regression suite. Owner manual acceptance is pending.

## Owner acceptance checklist

1. Load a fresh profile. Confirm the creator has a readable heading and accepts keyboard navigation.
2. Tab to the selected preset and change presets with the arrow keys. Confirm the model and name still save.
3. Reopen Edit Character. Hold a movement key, close with Escape, and verify focus returns and the held key stays cleared.
4. At 375 and 390 px, expand Controls and confirm the badge, speedometer and interaction prompts do not collide.
5. At 768, 1280 and 1920 px, check the clock, Street Cash, wallet launcher, FPS and mission objective together.
6. Talk to Maya and Marcus with E. Verify focus, Continue, Escape, and mission choices.
7. Enter and exit a car. Check WASD, Space, E, R, camera and debug shortcuts after interacting with HUD controls.
8. Open the garage while a car is parked. Review a respray, cancel with Escape, and verify occupancy and balance.
9. Open guest reset confirmation and cancel. In a disposable browser profile, verify that confirming resets progress and retains character appearance.
10. Open Arc Wallet by keyboard. Check guest play, explicit connection, wrong network, unavailable balance and focus restoration using a mock or test provider.
11. Review a transfer with a mock provider. Check recipient and amount errors, exact amount, Cancel/Confirm order and pending/saved/verified/unknown status labels.
12. Inspect Dough & Daisy Bakery and Lumen Books at day and night on foot and from a car. Confirm clean road edges and readable HUD.

The branch remains `main` at `fd816bc`. Phase 7.2 changes are unstaged.
