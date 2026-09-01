# Launch Bay audit remediation

The independent source audit covered commit `e9d6466958f13600e816b0df34996b38a44957c3` and reported one Critical, four High, four Medium, five Low, and three informational findings. That audited commit must not be deployed. The independent retest of `3a23535` subsequently closed C-1 and H-1 through H-4 and classified M-1, M-2, and L-1 as partially fixed. Their v1.3 follow-up is recorded in `docs/audit-retest-followup-2026-09-01.md`.

## Blocking findings

| Finding | Remediation | Regression evidence |
|---|---|---|
| C-1 reward entitlement used tier-based token ID | `HoodedGenesis` records an immutable monotonic `mintSequence` for every token, including Founder IDs 1-10. `HeroRoundRewardVault` indexes checkpoints with that sequence. | Real `HoodedGenesis` mixed-tier test mints Icon ID 2981 before Recruit ID 11, funds two rounds, and reconciles every claim to zero liability. |
| H-1 activation allowed an unfunded sale | `activate()` requires the full `saleAllocation` balance. | Unfunded activation reverts `sale unfunded`. |
| H-2 failed refunds were caller-only | Added permissionless `refundFor(address)`, crediting only the contributor's pull balance. | Two silent contributors are refunded by a third party, then the complete unsold allocation burns. |
| H-3 ERC-20 quote stranded liquidity | Production factory and coordinator now reject non-native quote assets. | Factory regression rejects an ERC-20 quote configuration. |
| H-4 Safe approval did not bind economics | EIP-712 approval includes `configHash`, calculated over token, sale, liquidity, direct allocations, and vested allocations. The API returns the exact typed-data payload before accepting a signature. | Changing only `saleFeeBps` after signing reverts `invalid approval`. |

## Medium and low hardening

- M-1 at v1.2: production requires a nonzero liquidity quote share; the retest identified an undersized-allocation residual now addressed in v1.3.
- M-2 at v1.2: the factory created 730-day vaults but enforced only their presence; v1.3 enforces a 5–10% vested supply range and starts vesting at sale end.
- M-3: sale and liquidity burns use a typed burn interface and verify the exact total-supply decrease.
- M-4: the coordinator clears its adapter allowance immediately after the adapter returns.
- L-1 at v1.2: a newer permit could reduce an allowance, but an older unused permit remained usable; v1.3 enforces monotonically increasing presented nonces and adds signer-controlled nonce-floor revocation.
- L-3: Genesis payment and routing use `SafeERC20`.
- L-4: the duplicate eligible-supply read was removed.
- Process: `forge-std` v1.16.2 is pinned from the official Foundry repository, and the reward regression uses the production NFT rather than a sequential-only mock.

## Retest request

The auditor reran the original PoCs and closed the Critical and all four High findings at `3a23535`. The Robinhood Uniswap v4 adapter remains unimplemented and outside this remediation; it must be built, fork-tested, and audited before any launch deployment.
