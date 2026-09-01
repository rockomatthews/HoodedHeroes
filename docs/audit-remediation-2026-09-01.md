# Launch Bay audit remediation

The independent source audit covered commit `e9d6466958f13600e816b0df34996b38a44957c3` and reported one Critical, four High, four Medium, five Low, and three informational findings. That audited commit must not be deployed. This document records the remediation included in the same commit as this file; it is evidence for auditor retesting, not a self-issued clearance.

## Blocking findings

| Finding | Remediation | Regression evidence |
|---|---|---|
| C-1 reward entitlement used tier-based token ID | `HoodedGenesis` records an immutable monotonic `mintSequence` for every token, including Founder IDs 1-10. `HeroRoundRewardVault` indexes checkpoints with that sequence. | Real `HoodedGenesis` mixed-tier test mints Icon ID 2981 before Recruit ID 11, funds two rounds, and reconciles every claim to zero liability. |
| H-1 activation allowed an unfunded sale | `activate()` requires the full `saleAllocation` balance. | Unfunded activation reverts `sale unfunded`. |
| H-2 failed refunds were caller-only | Added permissionless `refundFor(address)`, crediting only the contributor's pull balance. | Two silent contributors are refunded by a third party, then the complete unsold allocation burns. |
| H-3 ERC-20 quote stranded liquidity | Production factory and coordinator now reject non-native quote assets. | Factory regression rejects an ERC-20 quote configuration. |
| H-4 Safe approval did not bind economics | EIP-712 approval includes `configHash`, calculated over token, sale, liquidity, direct allocations, and vested allocations. The API returns the exact typed-data payload before accepting a signature. | Changing only `saleFeeBps` after signing reverts `invalid approval`. |

## Medium and low hardening

- M-1: production requires a nonzero liquidity quote share; the coordinator independently rechecks it.
- M-2: the production factory deploys every community vesting vault itself, requires at least one vested allocation, and enforces `730 days` on-chain. The full vested allocation is included in `configHash`.
- M-3: sale and liquidity burns use a typed burn interface and verify the exact total-supply decrease.
- M-4: the coordinator clears its adapter allowance immediately after the adapter returns.
- L-1: a newer eligibility permit may reduce as well as increase its cumulative allowance.
- L-3: Genesis payment and routing use `SafeERC20`.
- L-4: the duplicate eligible-supply read was removed.
- Process: `forge-std` v1.16.2 is pinned from the official Foundry repository, and the reward regression uses the production NFT rather than a sequential-only mock.

## Retest request

The auditor should rerun the original PoCs and review the new regressions, configuration hash, vesting deployment, and API typed-data encoding. No Critical or High finding is represented as closed until the auditor issues a remediation report against this commit. The Robinhood Uniswap v4 adapter remains unimplemented and outside this remediation; it must be built, fork-tested, and audited before any launch deployment.
