# Security and Release Gates

## Invariants

- Exact supply is fully accounted for at creation.
- No post-construction mint, freeze, blacklist, transfer-tax, or arbitrary upgrade authority exists.
- Quote assets and sale tokens are conserved across every contribution, claim, refund, fee, and unsold-token path.
- Sale proceeds, fee shares, and refunds accrue to recipient-owned pull balances. A reverting recipient may block only its own withdrawal, never another wallet's settlement.
- Each contributor settles once.
- Anyone can settle a successful allocation for its contributor, and unsold tokens remain locked until all contributions settle.
- The protocol fee never exceeds 1% and recipients are visible before signing.
- Failed launches become permissionlessly refundable.
- Creator allocations vest for at least 12 months; the `$HOODED` contributor allocation vests for 24 months.
- Liquidity cannot be withdrawn by a HOODED administrator.

## Required evidence before owner canary consideration

Static analysis, fuzzing, invariants, reproducible builds, SBOM, mainnet-fork tests, independent audit, legal review, multisig verification, timelock exercise, incident drill, public source verification, decoded transaction simulation, and explicit approval.

Passing these gates makes a release eligible for an owner signature. It never triggers deployment automatically. Creation is sealed and public activation is a separate transaction.
