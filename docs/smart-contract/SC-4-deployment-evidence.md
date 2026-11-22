# VEXTRIDE SC-4 — Owner deployment evidence

| Field | Value |
| --- | --- |
| Network | Arc Mainnet, chain ID **5042** |
| RPC | `https://rpc.mainnet.arc.io` |
| Contract | `VextridePaymentRouter` at `0xcAD7E77c93485F7eADe96AC7a58437ded3777FCF` |
| Deployment transaction | `0x290fe468443b15476fa2aa9c4ab831f5ae89f6883bbe4a61c390a1e058dfe20a` |
| Receipt | Successful contract creation in block **32,544,556** |
| Immutable recipient and deploying account | `0xa871d14AdBa4eacbD1fd63F5BD13fE0D80198b65` |
| Canonical token | `0x3600000000000000000000000000000000000000`, six ERC-20 decimals |
| Runtime Keccak-256 | `0x456cd28cc99be5c44370c206d6f6297ffcc69a85cc2857eca06ea8ea11346a5a` |
| Explorer source verification | **Exact Match**, as confirmed by the owner. Solc **0.8.28**, optimizer **200**, EVM **Cancun**. |
| Real router payment acceptance | **PENDING** |

SC-5 independently checked the public receipt, both getters and deployed runtime via read-only Arc Mainnet RPC. It reproduced an exact byte-for-byte match against the local Solc artifact after inserting the immutable recipient. The explorer API refused access from the SC-5 environment, so the explorer's Exact Match badge is recorded as owner evidence. The confirmed creation receipt proves deployment. Payment acceptance requires a separate independently verified `pay(bytes32,uint256)` transaction with both payment and USDC transfer log evidence.

The deployment account is also the immutable recipient. The router rejects self-payment. An owner-authorized payer at a different address is required for any later live payment test. [Contract on Arc Explorer](https://explorer.arc.io/address/0xcAD7E77c93485F7eADe96AC7a58437ded3777FCF) · [Deployment transaction](https://explorer.arc.io/tx/0x290fe468443b15476fa2aa9c4ab831f5ae89f6883bbe4a61c390a1e058dfe20a)
