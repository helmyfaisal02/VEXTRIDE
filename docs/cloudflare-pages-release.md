# VEXTRIDE — Cloudflare Pages Free release runbook

**Status: prepared locally. Public release and real router payment acceptance are owner-controlled.** Use a free Cloudflare account and the generated Pages domain. This project has no VPS, Pages Functions, Worker, database, custom DNS requirement or private build variable.

## Reproduce the production artifact

Use Bun **1.4.4** and the committed `bun.lock`. Both `.bun-version` and `packageManager` record the release version. Local verification used Linux x64.

```bash
bun --version
bun install --frozen-lockfile
bun audit --prod
bun audit
bun run check
bun run verify:all
bun run build:pages
bun run vite preview --host 127.0.0.1 --port 4178 --strictPort
```

Vite emits `dist/`. The Pages build checks the 25 MiB individual file limit, 20,000 file limit and expected static files. The preview command verifies local startup. The browser smoke test additionally applies the deployed Content Security Policy and tests the nested-route fallback. [Pages limits](https://developers.cloudflare.com/pages/platform/limits/)

## Connect GitHub and configure deployment

1. In the owner Cloudflare dashboard on the **Free** plan, open **Workers & Pages**, choose **Create application → Pages → Connect to Git**, and grant the Cloudflare GitHub App access to **helmyfaisal02/VEXTRIDE** only.
2. Choose the repository and set the project name to `vextride` if available. Cloudflare shows the actual `<project>.pages.dev` hostname at creation.
3. Use the settings below. Apply the same build variables to Preview if preview builds are enabled.

   | Setting | Value |
   | --- | --- |
   | Production branch | `main` |
   | Framework preset | `None` |
   | Root directory | repository root |
   | Build system | v3 |
   | Build command | `bun install --frozen-lockfile && bun run build:pages` |
   | Build output directory | `dist` |
   | Build variable | `BUN_VERSION=1.4.4` |
   | Build variable | `SKIP_DEPENDENCY_INSTALL=1` |
   | Application environment variables | none |

4. From the reviewed local checkout, the owner may run `git push origin main`. If Pages is already connected to this branch, pushing can publish automatically. Disable production automatic deployments in **Settings → Builds → Branch control** first if a push must remain private to GitHub pending review.
5. For a new project, select **Save and Deploy** only when the owner intends to publish the reviewed `main`. For an existing project, explicitly re-enable the reviewed branch trigger or use the dashboard's deployment Retry action for that commit when available. Confirm **Deployments** lists the expected Git SHA and success before sharing the domain. [Pages Git setup](https://developers.cloudflare.com/pages/get-started/git-integration/) · [Build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/) · [Build-image variables](https://developers.cloudflare.com/pages/configuration/build-image/)

The app uses root-relative hashed assets. With no top-level `404.html`, Pages serves the SPA for non-asset paths. The `_headers` file enables a CSP allowing local scripts, WebAssembly compilation for Rapier, Arc RPC, existing Google fonts and the two trusted Arc Studio frame origins. It adds MIME sniffing protection, referrer protection and a permissions policy disabling unused browser features. Hashed assets are immutable-cached. Leave HTML caching to Pages so a new release can refer to new chunks. Keep Cloudflare Rocket Loader and custom HTML rewriting off for this app. ES modules and wallet injection depend on normal browser startup. [SPA serving](https://developers.cloudflare.com/pages/configuration/serving-pages/) · [Pages headers](https://developers.cloudflare.com/pages/configuration/headers/)

## Production readiness checklist

- [ ] Record the intended Git SHA, build logs, file inventory, final `*.pages.dev` origin and whether branch triggers are enabled. Run both audits and review any new advisories against the [dependency remediation report](dependency-security-remediation.md).
- [ ] Confirm the site loads at `/`, an arbitrary nested path and after refresh. Check Safari/Firefox and a Chromium browser where available. Desktop requires WebGL2 and keyboard/mouse. Mobile UI is responsive, with no touch driving controls.
- [ ] On the production origin, start as a guest. Confirm no wallet request on load, verify the city and camera, walk and enter a vehicle, check the missions and garage, then reload and confirm guest state survives.
- [ ] Open Arc Wallet, check that the lazy chunk loads and the UI fits narrow and wide viewports. Verify the top-level origin and that secure context, browser storage and Web Locks work.
- [ ] Test wrong chain, wallet denial and disconnect/reconnect without sending real funds. Check actual Arc RPC read access and correct chain on the production origin.
- [ ] Verify the public contract and recipient against the [SC-4 evidence](smart-contract/SC-4-deployment-evidence.md). Keep any live payment acceptance **PENDING** until the owner completes the separate procedure and supplies verifiable evidence.
- [ ] Check CSP and console output on the real domain. Confirm JS responses have JavaScript MIME types and imports succeed after a new release. Wallet linkage and guest saves are browser-profile and origin scoped. Preview, localhost and production do not share them.

## Owner-only live payment acceptance

Real USDC and gas are at risk even when a transaction reverts. Follow this procedure only after explicit authorization for the specific payer, amount, allowance and payment. The recipient/deployer address cannot be the payer. Never share credentials or paste keys into the app.

1. Use a **different owner-authorized payer**, with enough USDC for the agreed amount and network fees. Open the intended HTTPS origin in a top-level browser tab. Connect deliberately and verify Arc Mainnet **5042**.
2. Choose **Fixed-recipient router**. Verify the address and immutable recipient from the [SC-4 evidence](smart-contract/SC-4-deployment-evidence.md). Enter the approved amount, review the exact units, current allowance, reference and fee details, and record the public reference privately for comparison.
3. If the UI requires allowance, review the ERC-20 token destination, router spender and exact amount in the wallet. Approve only if this separate transaction was authorized. Wait for verified approval. Check that VEXTRIDE never advances directly to a wallet payment prompt.
4. Select **Review Approved Payment**, or review the payment directly if the original allowance was sufficient. Check the fee again and confirm the same payer, amount, recipient, reference and network. Separately accept the wallet payment only when authorized.
5. Verify the actual payment hash on Arc. Check successful receipt, sender, router destination, zero native value and exact `pay(bytes32,uint256)` calldata. Verify one matching router `PaymentSettled` and one matching canonical ERC-20 USDC `Transfer` in that receipt. Count the native companion event as the same movement. An approval hash or successful receipt alone cannot satisfy acceptance.
6. Reload. Reconnect the same payer and recheck the saved operation. Verify the app displays the same result and creates no new prompt. Compare Street Cash, saved progress and garage state before and after.
7. Record the verified payment hash and public reference in the owner's acceptance record. On uncertain outcome, check wallet activity and use the UI's hash recovery. Do not retry or create a second payment to test whether the first one happened. Until evidence passes, keep acceptance **PENDING**.

## Rollback and known risks

Stop production auto-deploys during an incident. In **Deployments**, select a prior known-good successful production deployment and choose **Rollback to this deployment**. A fresh site may have no prior production version. In that case, correct the issue and deploy reviewed known-good source, or keep the public launch on hold. Confirm the restored SHA, load a fresh tab, test saved guest progress and inspect unresolved router transactions read-only through the wallet and explorer. Rollback changes the hosted application and leaves already submitted approvals, transactions and the immutable router on-chain. [Cloudflare Pages rollbacks](https://developers.cloudflare.com/pages/configuration/rollbacks/)

The public RPC can fail or rate-limit. A hashless or cancelled/replaced intent without matching evidence may stay locked in that browser profile. Keep the payer and hash from the wallet available for recovery. Browser data deletion, private browsing, or changing origins can lose the journal. Do not use those actions as a way to retry an uncertain payment. Settlements are irreversible. Direct token sends to the router may be stranded. Exact allowances can remain after rejection, cancellation or failure. The current build provides no USDC-backed gameplay entitlement. Public launch of the payment feature should follow owner verification on the intended origin.
