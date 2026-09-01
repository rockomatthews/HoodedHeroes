# System Map

`LaunchManifestV1` is the shared contract between five surfaces:

1. Manifest Studio validates creator inputs and immutable identity.
2. Simulator calculates fills, refunds, fees, and allocation conservation.
3. Chain adapters prepare decoded unsigned transactions.
4. Indexers publish contract-address-first launch state and metadata history.
5. Code Bazaar attaches source, diff, tests, SBOM, build hash, and reviews.

## Implemented EVM foundation

- `FixedSupplyLaunchToken.sol`
- `LaunchFactory.sol`
- `ProRataFairLaunch.sol`
- `ImmutableReferralRegistry.sol`
- `TokenVestingVault.sol`
- `HoodedToken.sol`
- `HoodedGenesis.sol`

## Honest adapter status

- Robinhood Chain: owner-only mainnet canary candidate; no verified deployment bundled.
- Base: owner-only mainnet canary candidate; no verified deployment bundled.
- Solana: planned independent program; interface preview only.
