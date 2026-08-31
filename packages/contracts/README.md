# HOODED contracts

Original HOODED sources are licensed under AGPL-3.0-or-later. The package now includes the fixed-supply Launch Bay v1 testnet candidate: `FixedSupplyLaunchToken`, `LaunchFactory`, `ProRataFairLaunch`, and an immutable referral registry. These contracts are unaudited and must not be used on mainnet.

Unaudited testnet foundations only:

- `HoodedToken`: immutable one-billion `$HOODED` supply with no owner or mint authority.
- `HoodedGenesis`: exactly 3,000 tier slots, one primary mint per wallet, and the 40/40/20 receipt split.
- `SeasonRewardVault`: immutable Merkle claims with no owner withdrawal path.

Before any deployment: complete role analysis, invariant coverage, independent audit, Safe/timelock wiring, Robinhood Chain testnet verification, and a deployment rehearsal. Launch Bay and Stock Token claim contracts are intentionally not included in this unaudited vertical slice.
