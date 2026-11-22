# VEXTRIDE deployment readiness runbook

This runbook is for a future owner-authorized deployment. It describes the existing static game and the checks required before serving it publicly.

## Candidate build and local verification

Use a clean checkout and Bun **1.3.14** from `.bun-version`. The release candidate was also checked with Node **22.22.2** for Playwright and the artifact verifier. Vite **6.4.5** and TypeScript **7.0.2** were resolved from `bun.lock`. The build output is `dist/`.

```bash
bun --no-env-file install --frozen-lockfile --ignore-scripts
bun --no-env-file run lint
bun --no-env-file run typecheck
bun --no-env-file run build
bun --no-env-file run verify:all
bun --no-env-file run vite preview --host 127.0.0.1 --port 4178 --strictPort
```

With preview running, run `node docs/phase74/verify-artifacts.mjs dist` from the repository root. It checks file types, startup asset references, wallet preloading, selected leak markers, local HTTP delivery and SHA-256 identity. Compare the output with the [candidate inventory](evidence/artifacts.json). To compare files without HTTP, pass `dist --inventory-only`. Review the Rapier size warning in the build output and leave the warning threshold as configured.

Run `node docs/phase74/preview-check.mjs` against the same preview. Set `VEXTRIDE_PLAYWRIGHT_MODULE` to a separately installed Playwright entry if needed, `VEXTRIDE_CHROMIUM` to the Chromium executable, and `VEXTRIDE_EVIDENCE_DIR` to an evidence directory outside the app build. This browser check uses a disposable profile, synthetic mock accounts and intercepted Arc reads. The release report lists the additional browser and simulation suites. Vite preview is for local checks. [Vite static build and preview guide](https://vite.dev/guide/static-deploy.html)

## Hosting configuration to confirm with the owner

| Concern | Requirements and current status |
| --- | --- |
| Host and domain | Serve the verified contents of `dist/` from an HTTPS static origin at the root path. Hosting provider, domain, project, redirects, TLS and external security headers are **unknown**. The repository has no Vercel deployment configuration. |
| Routing | Serve `index.html` for application navigation and refresh on nested history URLs. Serve real files under `/assets/` with the proper script or stylesheet MIME type. Return a real 404 for a missing asset. The local preview serves the nested game link, but its generic HTML fallback can also catch a missing asset. Set the future host’s asset rule explicitly. |
| Base path | Vite currently uses the default root base and emits `/assets/…` paths. A subpath installation would require a separately reviewed base and dedicated testing. |
| Caching | Revalidate HTML so it points to the current release. Hashed assets can be cached as immutable. Publish the complete artifact together and retain prior hashed assets during roll-forward and rollback so existing tabs can load the wallet chunk. |
| Browser security | Check HTTPS and the actual response headers at the intended origin. Confirm MIME enforcement, referrer handling and the embedding policy. If enabling CSP, test the game’s WASM, styles and fonts, Arc RPC connections and any authorized Arc Studio framing before enforcing it. Limit third-party connections to the ones this build uses. Web Locks require a secure context and are required for transfer reservation. [Web Locks API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API) |
| Public environment values | The game needs **no public environment variables** to build or run. Arc Mainnet is configured in source with chain ID 5042, RPC `https://rpc.mainnet.arc.io`, and explorer `https://explorer.arc.io`. External typography requests go to `fonts.googleapis.com` and `fonts.gstatic.com`. |
| Private configuration | The static app needs **no secrets**. Optional operator credentials for legacy Circle/contract utilities belong in a separate private execution environment. The game build and static hosting environment do not need those utilities or their credentials. |
| Wallet and origin | Guest mode works with no wallet. Use a compatible injected provider only after explicit connection. Test secure-context and iframe behavior on the actual origin. Character, guest and Arc journal storage are origin-scoped, so a preview-to-production or domain change can appear as a fresh profile. |

Do not expose the permissive Vite Studio development server to public traffic. Serve the release artifact through the selected static host.

## Future smoke test and release decision

After a separately authorized deployment, open the exact intended HTTPS origin in isolated fresh and returning profiles. Confirm build hashes, HTML revalidation, hashed asset caching, nested refresh, true 404s for absent assets, desktop/mobile gameplay, keyboard dismissal and save reload. Verify that the wallet chunk is requested only when opened. Check guest operation without a provider and exercise payment review and status states using mocks. For live Arc checks use account-independent reads, such as chain ID, and public transaction inspection.

The wallet can request a **real, irreversible USDC transfer** if a user explicitly confirms in a real wallet on Arc Mainnet. Publish that warning and explain network fees and the separation from fictional Street Cash before enabling a public payment feature. Current acceptance is based on mocks and read-only RPC. No real-money VEXTRIDE journey has been verified.

Go for owner review when the artifact, regressions and local browser tests agree. Public release is no-go until the owner approves the candidate, validates the intended host and headers, accepts residual dependency risks, and separately decides how to validate or communicate the unverified real-money path.

## Rollback and incident response

1. Record the source commit, approved artifact hashes and host release identifier before activating a future release. Retain the current and previous known-good complete static artifacts.
2. If startup, asset delivery, saves, or payment review regress, stop the rollout and route the same origin back to the last known-good artifact. Restore its HTML and corresponding hashed assets together. Revalidate or purge stale HTML while retaining hashed assets needed by open tabs.
3. Rerun nested navigation, wallet chunk loading, guest hydration and mock payment smoke tests on the restored origin. A cross-origin fallback cannot read the same browser storage. Preserve existing guest and transfer records in place.
4. For unknown payment outcomes, use wallet activity and a read-only receipt/event check on Arc Mainnet. Leave unresolved journal records intact. Avoid resubmitting an unknown transfer. Frontend rollback cannot reverse an on-chain transaction.
5. Preserve sanitized build hashes, HTTP status, browser version and error category for triage. Escalate suspected secret exposure to the owner for independent investigation and rotation. Avoid collecting consent payloads, keys, tokens or raw wallet data.

## Future dedicated contract

The app uses the existing Arc USDC interfaces directly. A dedicated VEXTRIDE contract would need a separate decision about its purpose and trust model, a design and test plan, security review, and owner-authorized manual deployment and verification. This candidate has no dedicated contract address or contract readiness claim.
