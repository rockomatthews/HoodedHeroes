# HOODED contracts

Original HOODED sources are licensed under AGPL-3.0-or-later. The package includes the Launch Bay v1.4 owner-only lab path and full-configuration-bound Safe-approved production path. The auditor closed the initial Critical and High findings at `3a23535`; the v1.3 follow-up closed the three partial findings, while the v1.4 canonical-pool interface and eventual production adapter require independent review. It is not authorized for deployment.

Unaudited implementation foundations:

- `HoodedToken`: immutable one-billion `$HOODED` supply with no owner or mint authority.
- `HoodedGenesis`: exactly 3,000 tier slots, deterministic tier ID ranges, ten free founder Recruit IDs inside the cap, one public primary mint per other wallet, immutable metadata root/base URI, and the 40/40/20 receipt split.
- `ProductionLaunchFactory`: manifest-bound EIP-712 Safe approval, atomic fixed-supply distribution, and immutable liquidity coordination.
- `ProRataFairLaunch`: sealed activation, pro-rata settlement, eligibility permits, split DAO/liquidity proceeds, pull refunds, and unsold burns.
- `RobinhoodLiquidityCoordinator` and `PermanentPositionReceiver`: price-matched liquidity with pinned adapter/manager code hashes and no rescue or withdrawal path.
- `CanonicalPoolDescriptor`: indexer-safe pool identity committed to coordinator state and emitted after the permanent lock proves the returned position ID.
- Accounted-quote finalization: forced or CREATE2-prefunded native balance cannot alter liquidity sizing. After the claim deadline, permissionless terminal retirement burns an unfinalized allocation and redirects its sale-ledger quote to the immutable DAO proceeds recipient.
- `SeasonRewardVault`: immutable Merkle claims with no owner withdrawal path.

The lab factory binds creation to one immutable wallet. The production factory requires a review-Safe signature for the creator, manifest, nonce, and deadline. Both commit the manifest hash, prevent replay, and create every sale sealed. Activation is a separate creator transaction.

`HeroRoundRewardVault` is an independent cumulative-index reward primitive inspired by public reward-accounting patterns. It funds equal universal ERC-20 rounds across the sequential Genesis Hero supply without looping over holders; late-minted Heroes do not receive prior rounds, unclaimed value follows the NFT, anyone can trigger delivery to the current owner, and rounding carry is preserved. The vault can also permissionlessly harvest its immutable Launch Bay fee allocation. ERC-20 quote fees remain in that asset; native quote fees are atomically converted to the constructor-bound wrapped-native token before a round opens. It must not be used for eligibility-restricted Stock Tokens.

Before any deployment: complete role analysis, invariant coverage, mainnet-fork testing, independent audit, Safe/timelock wiring, bytecode verification, and a full unsigned simulation rehearsal. Stock Token claim contracts are intentionally not included in this unaudited vertical slice.

The production Uniswap v4 adapter is not included. Adapter security-configuration readback is a fail-closed integration gate, not evidence that callback or price protections are correctly implemented.
