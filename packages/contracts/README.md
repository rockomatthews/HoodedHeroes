# HOODED contracts

Original HOODED sources are licensed under AGPL-3.0-or-later. The package includes the fixed-supply Launch Bay v1 owner-only canary: `FixedSupplyLaunchToken`, `LaunchFactory`, `ProRataFairLaunch`, and an immutable referral registry. These contracts are unaudited and are not ready for deployment.

Unaudited implementation foundations:

- `HoodedToken`: immutable one-billion `$HOODED` supply with no owner or mint authority.
- `HoodedGenesis`: exactly 3,000 tier slots, one primary mint per wallet, and the 40/40/20 receipt split.
- `SeasonRewardVault`: immutable Merkle claims with no owner withdrawal path.

The canary factory binds creation to one immutable wallet, commits the manifest hash in each token, uses deterministic CREATE2 addresses, prevents manifest replay, and creates every sale sealed. Activation is a separate creator transaction. `PermanentPositionLock` can irreversibly receive exactly one predetermined LP-position NFT from one predetermined position manager; it has no owner, transfer, rescue, or arbitrary-call path.

Before any deployment: complete role analysis, invariant coverage, mainnet-fork testing, independent audit, Safe/timelock wiring, bytecode verification, and a full unsigned simulation rehearsal. Stock Token claim contracts are intentionally not included in this unaudited vertical slice.
