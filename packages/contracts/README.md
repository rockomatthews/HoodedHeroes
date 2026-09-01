# HOODED contracts

Original HOODED sources are licensed under AGPL-3.0-or-later. The package includes the fixed-supply Launch Bay v1 owner-only canary: `FixedSupplyLaunchToken`, `LaunchFactory`, `ProRataFairLaunch`, and an immutable referral registry. These contracts are unaudited and are not ready for deployment.

Unaudited implementation foundations:

- `HoodedToken`: immutable one-billion `$HOODED` supply with no owner or mint authority.
- `HoodedGenesis`: exactly 3,000 tier slots, one primary mint per wallet, and the 40/40/20 receipt split.
- `SeasonRewardVault`: immutable Merkle claims with no owner withdrawal path.

The canary factory binds creation to one immutable wallet, commits the manifest hash in each token, uses deterministic CREATE2 addresses, prevents manifest replay, and creates every sale sealed. Activation is a separate creator transaction. `PermanentPositionLock` can irreversibly receive exactly one predetermined LP-position NFT from one predetermined position manager; it has no owner, transfer, rescue, or arbitrary-call path.

`HeroRoundRewardVault` is an independent cumulative-index reward primitive inspired by public reward-accounting patterns. It funds equal universal ERC-20 rounds across the sequential Genesis Hero supply without looping over holders; late-minted Heroes do not receive prior rounds, unclaimed value follows the NFT, anyone can trigger delivery to the current owner, and rounding carry is preserved. It must not be used for eligibility-restricted Stock Tokens.

Before any deployment: complete role analysis, invariant coverage, mainnet-fork testing, independent audit, Safe/timelock wiring, bytecode verification, and a full unsigned simulation rehearsal. Stock Token claim contracts are intentionally not included in this unaudited vertical slice.
