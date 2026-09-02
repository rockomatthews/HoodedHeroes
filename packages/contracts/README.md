# HOODED contracts

Original HOODED sources are licensed under AGPL-3.0-or-later. The package includes the Launch Bay v1.5.0 owner-only lab path, full-configuration-bound Safe-approved production path, and Robinhood Uniswap v4 liquidity adapter. The auditor closed the initial Critical and High findings at `3a23535`; the v1.3 follow-up closed the three partial findings, and the auditor closed H-5/M-5 at `e780025`. H-6, the v1.4 canonical-pool interface and registry, and the new v1.5 adapter require independent review. It is not authorized for deployment.

Unaudited implementation foundations:

- `HoodedToken`: immutable one-billion `$HOODED` supply with no owner or mint authority.
- `HoodedGenesis`: exactly 3,000 tier slots, deterministic tier ID ranges, ten free founder Recruit IDs inside the cap, one public primary mint per other wallet, immutable metadata root/base URI, and the 40/40/20 receipt split.
- `ProductionLaunchFactory` plus the four `ProductionComponentDeployers`: manifest-bound EIP-712 Safe approval, atomic fixed-supply distribution, pinned deployer bytecode, deterministic caller-namespaced deployment, and immutable liquidity coordination. Splitting creation bytecode keeps every production contract below EIP-170.
- `ProRataFairLaunch`: sealed activation, pro-rata settlement, eligibility permits, split DAO/liquidity proceeds, pull refunds, and unsold burns.
- `RobinhoodLiquidityCoordinator`, `RobinhoodUniswapV4LiquidityAdapter`, and `PermanentPositionReceiver`: exact sale-price, full-range, no-hook Uniswap v4 liquidity with pinned runtime hashes, independent pool/position readback, and no rescue or withdrawal path.
- `CanonicalPoolDescriptor`: indexer-safe pool identity committed to coordinator state and emitted after the permanent lock proves the returned position ID.
- Accounted-quote finalization: forced or CREATE2-prefunded native balance cannot alter liquidity sizing. After the claim deadline, permissionless terminal retirement burns an unfinalized allocation and redirects its sale-ledger quote to the immutable DAO proceeds recipient.
- Finalization and terminal retirement are mutually exclusive: finalization closes at `claimDeadline`, and terminal retirement opens strictly afterward.
- `SeasonRewardVault`: immutable Merkle claims with no owner withdrawal path.

The lab factory binds creation to one immutable wallet. The production factory requires a review-Safe signature for the creator, manifest, nonce, and deadline. Both commit the manifest hash, prevent replay, and create every sale sealed. Activation is a separate creator transaction.

`HeroRoundRewardVault` is an independent cumulative-index reward primitive inspired by public reward-accounting patterns. It funds equal universal ERC-20 rounds across the sequential Genesis Hero supply without looping over holders; late-minted Heroes do not receive prior rounds, unclaimed value follows the NFT, anyone can trigger delivery to the current owner, and rounding carry is preserved. The vault can also permissionlessly harvest its immutable Launch Bay fee allocation. ERC-20 quote fees remain in that asset; native quote fees are atomically converted to the constructor-bound wrapped-native token before a round opens. It must not be used for eligibility-restricted Stock Tokens.

Before any deployment: complete role analysis, invariant coverage, mainnet-fork testing, independent audit, Safe/timelock wiring, bytecode verification, and a full unsigned simulation rehearsal. Stock Token claim contracts are intentionally not included in this unaudited vertical slice.

The production candidate adapter is included but unaudited. It binds the deployed PositionManager to the configured PoolManager and Permit2 contracts, permits only a zero hook, initializes or exactly matches the sale-derived price, uses explicit `MINT_POSITION` maximum inputs rather than the deprecated delta path, clears ERC20 and Permit2 allowances, and leaves no adapter balance. The coordinator independently recomputes the pool ID, initial price, full-range ticks, and exact expected position liquidity before recording the canonical pool. Independent source/bytecode review and a separately approved fork canary remain mandatory before deployment.
