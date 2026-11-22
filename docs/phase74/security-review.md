# Release security and dependency review

The release freeze preserves the Phase 7.3 controls for guest save revisions, Web Locks, conflict-aware reset, input isolation, wallet timeouts, late-response invalidation, duplicate prompts and minimal Studio preview diagnostics. It also preserves the separation between guest progress and account-scoped Arc history.

## Dependency findings

The fresh Bun advisory query returned **37 entries across eight transitive package names**, with 16 high, 15 moderate and six low entries. These are advisory entries and may overlap. All eight were absent from the set of modules with nonzero rendered length in the production Rollup chunks, including the lazy wallet and CCIP chunks. This is evidence about the inspected browser output. Installed dependencies can still expose separate build, development or command-line tooling. The checks did not execute contract utilities.

| Package | Locked versions | Advisory entries | Installed dependency path and remediation |
| --- | --- | --- | --- |
| `@grpc/grpc-js` | 1.9.16 | 1 high, 1 low | Circle web wallet SDK → Firebase Firestore. Firestore’s `~1.9.0` constraint excludes the registry’s advised 1.13.6 floor. Upgrade via a Firebase/Circle combination that accepts a patched version. |
| `decode-uri-component` | 0.2.2 | 1 high, 1 moderate | Legacy wagmi/WalletConnect → query-string. A registry version above the reported ranges exists, but the current parent’s `^0.2.2` range excludes it. Upgrade the parent chain rather than overriding its API assumptions. |
| `elliptic` | 6.6.1 | 1 low | Legacy ethers signing utilities under Circle SDK paths. The latest registry version remains within the advisory range. Prefer removing unused signing tooling or migrating to a supported replacement when reviewing that toolchain. |
| `stream-json` | 1.9.1 | 3 moderate | Circle kits → Solana web3 → jayson. The reported fixed range requires a later major. Validate parent support and test the separate SDK integration before upgrading. |
| `toml` | 3.0.0 | 6 high | Circle kits → Anchor. The installed parent asks for `^3.0.0`. The registry has a later version beyond the listed affected ranges. Coordinate an Anchor/SDK update rather than forcing a major override. |
| `undici` | 6.19.7 | 7 high, 10 moderate, 4 low | Firebase Auth under the Circle web wallet SDK. A later 6.x floor is listed in the advisories, but Firebase Auth pins the current version. Update through a Firebase/Circle combination that permits a patched transport. |
| `uuid` | 8.3.2, 9.0.1, 11.1.1, 14.0.3 | 1 moderate | Several legacy SDK and wallet tooling paths contain versions below the affected cutoff. Upgrade the parent chains to versions whose ranges exclude the vulnerable copies. |
| `zod` | 3.22.4, 3.25.67, 3.25.76, 4.6.7 | 1 high | Several Circle SDK packages use pinned v3 validators. The listed range extends through versions below 4.6.6. Replace affected parent pins through an SDK update tested against the v4 API. |

These are remediation paths for a separate dependency review. No compatible parent upgrade was validated in this release freeze and no dependency was changed. The inspected static browser artifact may proceed to owner review with this documented limitation. Evaluate the affected toolchain separately before using any of those installed packages in a hosted process or operator workflow. [Advisory IDs, ranges, registry versions and browser reachability evidence](evidence/dependencies.json)

## Risk register

| Risk | Evidence and release disposition |
| --- | --- |
| Hosted headers, routing and stale chunks | Local preview served the nested SPA URL and each shipped asset byte-for-byte. It can return HTML for some absent asset requests. Actual hosting, policy and cache behavior remain unverified. Apply the runbook’s host checks before public release. |
| Dependency or build-tool exposure | The frozen checkout built reproducibly and the eight advisory package names were absent from rendered browser code. This does not establish reachability or security for the optional installed tools or the public dependency supply chain. |
| Real-money correctness and availability | Mocked transfer approval and lifecycle checks passed. Live Arc reads returned chain 5042 and an existing successful receipt with zero matching ERC-20 events. The sampled direct-transfer search produced no qualified candidate. Real-money behavior remains unverified. |
| Arc log representation | Current Arc docs describe a native system log in 18-decimal units alongside the ERC-20 contract log in six-decimal units for a direct ERC-20 transfer. The candidate verifies the existing ERC-20 emitter and intent only. The new regression exercises both companion logs and rejects native-only evidence. [Arc event indexing documentation](https://docs.arc.io/integrate/infrastructure/indexing-events) |
| Local storage and wallet lifetime | Cross-tab conflict checks pass. Browsers without Web Locks retain compare-before-write guest fallback and cannot reserve transfers. Sessions can still lose a write when terminated early, and a never-settled provider prompt retains the duplicate guard for that page. |
| Build/configuration privacy | Inspecting tracked file names found no environment or private-key files. The artifact check found no PEM, standard GitHub credential, source-map file or dev relay markers. These targeted checks cannot rule out all credential encodings. Runtime inspection did not observe a localhost dependency outside the QA origin, a testnet override, auto-connect, or developer trace relay. |
| Runtime coverage | Chromium SwiftShader and the automated simulations cover measured compatibility. Real devices, assistive technology, wallet extensions, sustained hardware sessions, and the target hosting origin still require owner checks. |
