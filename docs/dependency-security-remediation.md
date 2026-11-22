# VEXTRIDE production dependency security remediation

**Production dependency gate: GO.** The release lockfile returns zero advisories in both production and full scans. The owner still controls publishing and the on-origin smoke check. Independent live router payment acceptance remains **PENDING**.

## Audit comparison

Used Bun **1.4.4** against both lockfiles and the same registry advisory service. The baseline was SC-5 commit `42a140b3`. The numbers count advisory entries, which may overlap.

| Scope | Before | After |
| --- | --- | --- |
| `bun audit --prod` | 37 entries across eight packages (16 high, 15 moderate, six low) | **0** · 123 packages checked, exit 0 |
| `bun audit` | 37 entries across eight packages (16 high, 15 moderate, six low) | **0** · 339 packages checked, exit 0 |

| Package | Baseline locked versions | Advisory entries | Baseline path removed from the release install |
| --- | --- | --- | --- |
| `zod` | `3.22.4`, `3.25.67`, `3.25.76`, `4.6.7` | 1 high | Circle browser kits and modular wallets, and the unused wagmi connector graph. Viem's ABI tooling still declares an optional peer range, with no Zod package resolved in the release lockfile. |
| `undici` | `6.19.7` | 7 high, 10 moderate, 4 low | Circle W3S web SDK → Firebase. `undici-types` remains a type-only Node declaration dependency. |
| `@grpc/grpc-js` | `1.9.16` | 1 high, 1 low | Circle W3S web SDK → Firebase Firestore. |
| `decode-uri-component` | `0.2.2` | 1 high, 1 moderate | wagmi connectors → WalletConnect → `query-string`. |
| `uuid` | `11.1.1`, `14.0.3`, `8.3.2`, `9.0.1` | 1 moderate | Circle web wallets and Solana tooling, and wagmi's wallet connector graph. |
| `toml` | `3.0.0` | 6 high | Circle App Kit → Anchor. |
| `elliptic` | `6.6.1` | 1 low | Legacy Ethers signing under the removed SDKs and the Node compatibility shim graph under Vite. |
| `stream-json` | `1.9.1` | 3 moderate | Circle kits → Solana web3 → `jayson`. |

The fresh install and lockfile contain none of the eight affected package names as resolved dependencies. Lockfile entries fell from 1,119 to 353, representing 1,001 and 350 distinct package-version identities respectively. Every retained package-version identity was present in the baseline. No incompatible upgrade, new package resolution or advisory waiver was required. [Bun audit scope](https://bun.com/docs/pm/cli/audit)

## Changes and exposure

- Removed five unused Circle SDK roots from `package.json`: `@circle-fin/adapter-viem-v2`, `@circle-fin/app-kit`, `@circle-fin/modular-wallets-core`, `@circle-fin/user-controlled-wallets` and `@circle-fin/w3s-pw-web-sdk`.
- Removed the unreachable `src/config.ts` starter wallet configuration and its `wagmi`, `connectkit` and `@tanstack/react-query` dependencies. Also removed unused `@web3icons/react`, `clsx`, `framer-motion`, `sonner` and `tailwind-merge`. Updated the dev prebundle entries and removed SDK-specific TypeScript aliases. Explicit Node types now support the existing CLI sources and checks without relying on unrelated ambient transitive types.
- Removed `vite-plugin-node-polyfills` from the build config and dev dependencies. Source inspection showed the browser app uses browser APIs. The clean build and Chromium tests cover the game, lazy wallet and receipt checks without the old shims. Listed the already resolved `@dimforge/rapier3d-compat@0.14.0` directly as a dev dependency because the existing regression scripts import it.
- Kept Viem **2.57.5**, the existing browser import. Removed its redundant global override after removing the unused connector trees. Kept `@circle-fin/developer-controlled-wallets` and `@circle-fin/smart-contract-platform` at locked **10.8.1**, with locked Axios **1.21.0**. The existing operator scripts import those two SDKs, so their source and dependencies remain. The scripts typecheck and both required SDK exports resolved in an import-only check.
- The React entry point uses the existing injected EIP-1193 wallet session and Viem. The application, Arc Mainnet configuration, deployed router binding, Solidity contracts and gameplay sources are preserved. A Rollup module inventory checked 513 rendered module entries, including the lazy wallet, and found none of the eight implicated packages or either retained operator SDK. The install-level removals also eliminate the flagged components from Vite build-time and development installation paths. The browser inventory alone would not establish that.
- Bun remains a separate toolchain input. `.bun-version`, `packageManager` and the Pages `BUN_VERSION` setting all specify **1.4.4**. Validation used that exact binary, including nested Bun invocations, from an isolated tool directory. The machine's original Bun 1.3.14 executable was preserved. Use a version manager or install Bun 1.4.4 locally, confirm with `bun --version`, and use `bun install --frozen-lockfile` as in [the Pages runbook](cloudflare-pages-release.md).

The registry audit covers known matching advisories for this dependency graph. It provides no guarantee about unknown issues, malicious future package releases, host or build-image software, wallet extensions, or the integrity and availability of public RPC responses. Keep frozen installs, review lockfile changes, and repeat both audits before publishing. The operator tooling remains separate from the public static site. Any future restoration of removed SDKs requires a fresh compatibility and dependency review.

## Validation

| Check | Result |
| --- | --- |
| Clean install | Bun 1.4.4 frozen lockfile install passed, 259 packages installed on Linux x64. A repeat install left the lockfile byte-identical. Bun 1.3.14 also accepted a frozen dry-run. |
| `bun run check` | Lint and TypeScript passed. |
| `bun run verify:router` | **12 groups passed.** |
| `bun run verify:all` | **1,120 checks passed.** |
| Foundry | Offline build passed. **40 passed**, zero failed, one opt-in fork suite setup skipped in the default run. The explicit Arc Foundry fork at block 32,527,875 passed **7/7**, using local synthetic balances. |
| Production build | `bun run build:pages` passed. Eight files totaling **3,637,538 bytes**. The largest asset is Rapier at **2,058,365 bytes**, below the 25 MiB limit. The existing Rapier chunk-size warning remains. |
| Production HTTP and assets | Nine preview HTTP checks passed, including nested SPA fallback. The artifact inventory found no source maps, dev diagnostic markers or recognized credential signatures. |
| Chromium production smoke | Router flow passed at 390 × 844 and 1280 × 720 with the Pages CSP, simulated RPC and injected wallet mocks. Included approval and payment confirmation, pending recovery, and reload. The existing five-viewport fixture checked guest reopening, focus, lazy wallet loading and WebGL recovery. SwiftShader supplies software-rendering evidence. |

No public approvals, payments, signing, contract deployment or production publishing were performed.
