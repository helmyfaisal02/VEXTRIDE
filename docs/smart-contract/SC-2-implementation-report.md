# VEXTRIDE SC-2 — Payment router implementation

The owner confirmed **SC-1 Option B**, the fixed-recipient non-custodial router. Option A remains the accepted game's direct USDC transfer. Option C, the purchase contract, remains outside the approved scope. The [SC-1 specification](SC-1-architecture.md) was preserved. At the initial checkpoint, `main` matched `origin/main` at `d970ce8`, the configured identity was `helmyfaisal02 <hijautua39@gmail.com>`, and the unstaged SC-1 document was the only untracked file.

## Contract and interface

[VextridePaymentRouter.sol](../../contracts/VextridePaymentRouter.sol) uses Solidity **0.8.28**, the **Cancun** target, and the existing optimizer setting of **200 runs**. It uses the project's pinned OpenZeppelin **5.6.1** SafeERC20 and storage-based ReentrancyGuard. Foundry configuration, dependencies, and CREATE2 scripts retain their existing versions and behavior.

| Interface | Behavior |
| --- | --- |
| `constructor(address paymentRecipient)` | Requires chain ID 5042. Rejects the zero address, the router's own address, and the canonical USDC token as recipient. Requires deployed USDC code and a valid six-decimal metadata response. Binds the recipient permanently. |
| `recipient() → address` | Returns the immutable recipient. |
| `usdc() → address` | Returns `0x3600000000000000000000000000000000000000`. |
| `isReferenceUsed(address payer, bytes32 paymentReference) → bool` | Reads the payer-scoped flag for this router instance. |
| `pay(bytes32 paymentReference, uint256 amount)` | Nonpayable. Rechecks the chain and rejects zero reference, zero or out-of-range amount, the recipient as payer, and any reference already used by this payer. |
| `PaymentSettled(address indexed payer, address indexed recipient, bytes32 indexed paymentReference, uint256 amount)` | Emits from the router after exact credit. The amount is an integer in six-decimal USDC units. |

The router defines `WrongChain(uint256)`, `InvalidRecipient(address)`, `UnsupportedUSDC()`, `InvalidReference()`, `InvalidAmount(uint256)`, `PayerIsRecipient()`, `ReferenceAlreadyUsed(address,bytes32)` and `UnexpectedRecipientCredit(uint256,uint256)`. SafeERC20 propagates token reverts where available and rejects a false return. Allowance and balance failures come from the token. The inherited guard rejects nested payment calls. Foundry's method identifier inspection found the four public methods in the table.

## Atomic settlement and approval

1. The caller supplies a public, nonzero reference and an amount in atomic ERC-20 units. For example, `1_234_567` represents 1.234567 USDC. The router checks the upper bound `type(uint256).max / 10^12` to stay within the native representation. It passes the submitted integer to the token unchanged.
2. The guarded call tentatively consumes `(msg.sender, paymentReference)`, reads the recipient's balance, and calls SafeERC20 `transferFrom` directly from the payer to the recipient. Another payer can use the same reference bytes in its own namespace. Separate router deployments have separate namespaces. References should contain opaque identifiers without customer data.
3. It reads the recipient's balance again and requires the exact increase before emitting `PaymentSettled`. A token revert, false result, or mismatched credit rolls back the attempted transfer, allowance consumption within the payment, and the reference reservation. A separately mined approval remains independent of the failed payment.

A future payer without sufficient allowance may need a separate USDC approval for the verified router before payment. That future flow should request the intended amount and recheck account, chain, spender, recipient, allowance and fees before payment. The router cannot grant itself allowance. Its payment interface has no caller-selected destination, platform fee, proxy upgrade, pause role, withdrawal or rescue operation. No application or wallet integration was added.

## Event verification and residual risk

A future reconciler must match the Arc Mainnet chain, the reviewed router identity and call, the transaction and successful receipt, the expected payer, immutable recipient, exact amount and application reference. It should corroborate the router event with the matching six-decimal USDC transfer log in the same receipt. Approval events, unverified hashes and successful receipts alone do not establish settlement. Arc can expose the same underlying movement through an 18-decimal native system log. Filter by emitter and avoid duplicate accounting. Reference consumption records a payment attempt that succeeded for that payer and router. It cannot decide whether the amount satisfies an invoice or whether a game service should be fulfilled. Cross-deployment order idempotency requires a separate policy. [Arc event representation](https://docs.arc.io/arc/references/usdc-system-events)

The credit check depends on the behavior and truthful balance reporting of the canonical token. The contract cannot defend against an incorrect immutable recipient, a lookalike contract, a compromised wallet or frontend, misleading RPC data, or future Arc protocol or token changes. OpenZeppelin's wrapper tolerates a successful call with empty return data when the token has code, so observing exact recipient credit is an additional check. [SafeERC20](https://docs.openzeppelin.com/contracts/5.x/api/token/erc20#SafeERC20)

The intended path credits the recipient directly. Someone can still transfer ERC-20 tokens to the router outside `pay`, and some protocol mechanisms can credit native value without invoking a payable entry point. Arc's native value and self-destruct rules can reject transfers that a generic EVM would accept. An unsolicited credit does not settle a payment and may be permanently stranded. A retired router's fixed destination continues to apply to direct calls. [Arc EVM differences](https://docs.arc.io/integrate/evm-differences)

## Local verification

Foundry commands ran in a scratch copy with network-disabled compilation/testing via `--offline`. The mock ERC-20 runtime was installed at the canonical address using Foundry's `vm.etch`, and `vm.chainId` selected 5042 locally. All test addresses and balances were synthetic. [Test suite](../../contracts/test/VextridePaymentRouter.t.sol)

| Check | Result |
| --- | --- |
| `forge build --offline` | Passed. Foundry reports naming notes for the lowercase `usdc` and `recipient` declarations, which retain the approved getter names. |
| `forge test --offline` | **37 passed**, 0 failed, 0 skipped. 28 unit tests, four fuzz tests, and five invariants. |
| `forge test --offline -vvv` | **37 passed**, 0 failed, 0 skipped. |
| Fuzz | **256 runs per test**, 1,024 runs per suite invocation. Positive amounts, distinct and repeated references, independent payers, and rollback then retry. |
| Invariants | **128 sequences × 64 calls per invariant**, 8,192 calls each and 40,960 handler calls per suite invocation. Zero handler reverts and discards in both runs. Expected router failures are caught and checked inside the handler. |
| Formatting and interface | Formatting check passed for both new Solidity files. Method identifiers matched the reviewed ABI. |
| Game regressions | TypeScript passed. `verify:transfer` and `verify:transfer-history` each passed seven groups. `verify:all` passed all **1,108** existing checks. The game checks used the unchanged accepted source. |

The unit matrix covers constructor and chain/token validation, exact payer debit and recipient credit, allowance consumption, topics and event data, both reuse cases, and separation between router deployments. Failure tests cover missing allowance, insufficient funds, token revert, false return after credit, under-credit, no movement, mismatched native value and callback reentrancy. They check reference rollback and absent settlement after failure. Additional tests cover compatible empty-return transfers, unsolicited USDC, locally modeled native credits, and the absence of recipient mutation and withdrawal selectors. The invariant handler compares each result, reference, debit, credit, allowance and settlement log with a bounded model using four payers and eight reference values. The invariant entry points check model agreement, total verified credit, failure accounting, token supply, router balances and immutable configuration.

**Local gas measurement.** Foundry's focused gas report measured **70,723 gas** for one successful `pay` call with the mock. The local constructor reported **441,123 gas** and a deployment size of **2,305 bytes**. This sample excludes the separate approval transaction and does not predict Arc execution gas or fees.

## Arc evidence and SC-3 prerequisites

The public read-only RPC returned chain **5042**, **1,798 bytes** of code at the canonical token interface, **6** decimals and a decodable allowance read for synthetic addresses. Arc documents ERC-20 allowances and `transferFrom` at that interface. The optional fork suite was not run. Stock Foundry mock execution does not exercise Arc's native token backend, blocklist semantics, companion logs, or gas rules. Arc-specific execution and mainnet settlement remain unvalidated. [Arc contract addresses](https://docs.arc.io/arc/references/contract-addresses) · [Arc execution and simulation differences](https://docs.arc.io/integrate/evm-differences)

Before any later deployment decision, independently review the source and artifact, permission surface, exact-credit assumptions, allowance handling, reference reconciliation, real Arc token behavior in an approved isolated environment, and event validation. Confirm the public recipient's address, chain, control and receipt eligibility through a trusted channel, and compare the exact reviewed address against the constructor argument and resulting immutable value. The address is permanent once deployed. Review the operational response to stranded funds or a retired recipient and separately approve any future frontend or fulfillment design.

The checkout remains at `d970ce8`. The two Solidity files and this report are unstaged alongside the preserved SC-1 document.
