# VEXTRIDE SC-3 — Deployment readiness

**NOT DEPLOYED. CONDITIONAL — RESIDUAL RISKS REQUIRE OWNER DECISION.** This is a preparation record. The recipient is undecided. There is no deployment address, deployment transaction, explorer source verification or live payment evidence. SC-4 requires separate approval. The owner handles any future deployment and source verification.

## Network and artifact

| Item | Reviewed value |
| --- | --- |
| Arc Mainnet | Chain ID **5042** (`0x13b2`). Public RPC `https://rpc.mainnet.arc.io`. |
| USDC | `0x3600000000000000000000000000000000000000`. ERC-20 calls use six decimals. Native balance and gas accounting use 18 decimals. The two interfaces share the same balance. |
| Source | `contracts/VextridePaymentRouter.sol:VextridePaymentRouter`, unchanged from `ca892d52544f26bca2fe373489459977ed22a1eb`. |
| Build | Solc `0.8.28+commit.7893614a`, EVM target Cancun, optimizer enabled at 200 runs, IPFS metadata hash, default non-IR compilation. Canonical inputs are [foundry.toml](../../foundry.toml), [remappings.txt](../../remappings.txt) and [bun.lock](../../bun.lock), with OpenZeppelin 5.6.1. No linked libraries. |
| ABI | `constructor(address paymentRecipient)`, `pay(bytes32,uint256)` (`d0ee4de0`), `isReferenceUsed(address,bytes32)` (`c90474cf`), `recipient()` (`66d003ac`), `usdc()` (`3e413bee`), `PaymentSettled(address,address,bytes32,uint256)`, and declarations for the contract and dependency errors. |
| Build artifact | `contracts/out/VextridePaymentRouter.sol/VextridePaymentRouter.json` holds ABI, creation bytecode, runtime template, immutable offsets and metadata. Output is generated locally. |
| Creation bytecode | **2,273 bytes** without constructor arguments. SHA-256 of raw bytes `df951b663b45b2d142eabae93695cb0fe3481da33150c9ebad27f4e1aa60d5e1`. The single ABI-encoded address adds 32 bytes, for **2,305 bytes** of complete constructor input. |
| Runtime template | **1,639 bytes**. SHA-256 of raw template bytes `696286d49fa3bed4e4f50d974b91da519da1785863dec95a48a04770e15636f4`. The compiler records six immutable substitutions for the recipient. A future deployed runtime must be compared with the template populated using the reviewed recipient. The template digest is not a deployed runtime digest. |
| Local constructor gas | **441,123 gas** in the standard mock fixture. The unchanged SC-2 mock measured **70,723 gas** for one successful `pay`. SC-3's expanded mock measured **73,363 gas**, including added fault-injection checks inside the mock token. Router bytecode is identical. Neither number includes an approval or predicts Arc transaction fees. |

Two isolated builds produced identical ABI, creation and runtime bytecode, immutable references and metadata. The debug source maps differ when the compilation unit contains the additional fork test because source indices differ. Match the raw bytes and archive the exact compiler input for any future deployment or source verification. [Arc network details](https://docs.arc.io/integrate/connect-to-arc) · [Arc USDC interface](https://docs.arc.io/arc/references/contract-addresses) · [Arc gas and fees](https://docs.arc.io/arc/references/gas-and-fees)

## Owner decisions and future preflight

- Approve an actual use case for fixed-recipient reconciliation independent of the existing game's direct-transfer feature. Record who governs references, expected amounts, evidence handling and cross-deployment order deduplication.
- Select the public recipient, confirm its checksummed address through a separate trusted channel, confirm who can control it and check that it can receive and manage USDC on Arc. For an intended contract recipient, review the actual Arc runtime and custody policy. Address checks and a metadata read cannot prove recipient control. Reject the zero address, the canonical token and the predicted router address. Record the approved public recipient with the artifact in a controlled deployment record.
- Compare the constructor argument with that record. It is one ABI-encoded address word, left-padded to 32 bytes. It cannot be changed after deployment. A wrong or lost destination can require retirement and a new deployment. Already settled transfers remain final.
- Pin the reviewed commit, dependencies and compiler. Preserve the build metadata and Solidity Standard JSON input. Re-run the standard mock suite and canonical fork suite before authorizing a deployment, and assess canonical bytecode and protocol changes since block 32,527,875.
- Recheck Arc chain ID, canonical token code and six-decimal metadata through independent read sources where practical. Use the exact reviewed artifact for a fresh deployment estimate at the time of the owner-controlled operation. Review fee inputs in 18-decimal native USDC. A payment amount is always an integer in six-decimal token units.
- Keep the future WSL HENA Foundry Keystore local, encrypted and access-restricted. Keep backup and recovery material separate from the repo and diagnostic outputs. Use a trusted owner-controlled shell and avoid credentials in command arguments, clipboard history, files in the checkout, logs or shared screens. Confirm the intended public signing address independently. SC-3 used only local test identities.

## Future source verification and read-only post-deployment checks

Arc's published deployment walkthrough documents Blockscout source verification for testnet. The official Arc Mainnet explorer is powered by Blockscout. Its documented UI supports Solidity Standard JSON, which can preserve the complete multi-file compiler input. Check that capability on the Mainnet instance when the owner authorizes SC-4. Preserve the deployed address, ABI-encoded constructor input, exact compiler version, EVM and optimization settings, source paths and dependency content. Compare any published source and ABI with the recorded artifact. No explorer verification request was submitted. [Arc deployment walkthrough](https://docs.arc.io/integrate/deploy-on-arc) · [Arc Mainnet explorer](https://explorer.arc.io/) · [Blockscout source verification options](https://docs.blockscout.com/devs/verification/blockscout-ui)

After a future authorized deployment, check the chain, creation transaction and successful receipt, matching block and contract address, runtime bytecode with recipient immutables applied, and the `recipient()` and `usdc()` getters. Record the contract address and starting block for reconciliation only after these checks. A successful deployment or source verification establishes neither consent to spend nor a successful payment. The existing VEXTRIDE verifier continues to handle direct USDC transfers. A future router verifier needs an independently reviewed policy for direct calldata, the immutable destination, settlement and canonical USDC event matching, and replacement or unresolved transactions.

On a revert or ambiguous deployment result, inspect the transaction hash if available and confirm receipt, sender nonce and deployed code as appropriate before considering any retry. A mined revert may cost gas. If the wrong recipient was deployed, stop presenting the old address, retain its historical verification records and use a separately approved replacement. There is no on-chain pause, upgrade or withdrawal. Old callers may still interact with the old address or have allowance set to it. Ordinary native calls are rejected, but funds sent directly via the token or credited outside the router entry point can be permanently stranded.

## Twelve owner SC-3 acceptance checkpoints

1. Confirm the review starts from `ca892d5` and the approved SC-1 and SC-2 documents are present.
2. Confirm the unstaged paths are the two test files and two SC-3 reports.
3. Build offline with Solc 0.8.28 and check the ABI and artifact sizes.
4. Re-run the standard mock suite and confirm all 37 accepted tests plus three new cases pass.
5. Check the 1,024-run fuzz results and the five stateful invariants.
6. Re-run the seven canonical tests with Arc Foundry at block 32,527,875.
7. Inspect exact token and native balance deltas, allowance consumption and the router and token event assertions.
8. Inspect failed allowance, valid retry, duplicate rejection, separate payer namespaces and wrong-chain tests.
9. Review the immutable recipient selection process and decide whether the no-rescue risk is acceptable.
10. Review the future reconciliation key and event evidence requirements.
11. Confirm TypeScript, transfer, transfer-history and full game regression results.
12. Record the SC-3 decision and keep the router undeployed unless the owner separately authorizes SC-4.

**SC-4 prerequisites** are owner acceptance of this review, an approved public recipient and reconciliation use case, independently reviewed recipient control and receipt eligibility, approval of the exact source and artifact, a current Arc compatibility check, acceptance of permanent stray-fund and immutable routing risks, and separate authorization for owner-controlled deployment. Consider an independent security review before inviting public funds. No test in SC-3 used a funded wallet or demonstrated a live VEXTRIDE payment.
