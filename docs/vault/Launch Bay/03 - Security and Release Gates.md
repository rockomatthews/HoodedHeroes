# Security and Release Gates

## Invariants

- Exact supply is fully accounted for at creation.
- No post-construction mint, freeze, blacklist, transfer-tax, or arbitrary upgrade authority exists.
- Quote assets and sale tokens are conserved across every contribution, claim, refund, fee, and unsold-token path.
- Each contributor settles once.
- The protocol fee never exceeds 1% and recipients are visible before signing.
- Failed launches become permissionlessly refundable.
- Creator allocations vest for at least 12 months; the `$HERO` contributor allocation vests for 24 months.
- Liquidity cannot be withdrawn by a HoodedHeroes administrator.

## Required evidence before mainnet consideration

Static analysis, fuzzing, invariants, reproducible builds, SBOM, independent audit, legal review, multisig verification, timelock exercise, testnet rehearsal, incident drill, public source verification, and explicit approval.

Passing these gates makes a release eligible for consideration. It never triggers deployment automatically.

