# Launch Bay v1 implementation

Launch Bay v1 is a fixed-price, timed, pro-rata fair-launch testnet candidate. The canonical `LaunchManifestV1` drives UI validation, simulation, public metadata, APIs, and contract configuration for Robinhood Chain, Base, and the staged Solana adapter.

## Implemented foundations

- Twelve deterministic manifest gates, including fixed supply, exact allocation conservation, approved chain quote assets, 1% fee cap, immutable authority flags, permanent liquidity, metadata completeness, reproducible source hashes, and no automatic mainnet path.
- Shared pro-rata allocation simulator with integer rounding equivalent to the EVM contract.
- Metaplex, Uniswap Token List, and DEX Screener payload generation from one versioned metadata record.
- Public launch list/detail/validation/simulation endpoints.
- Genesis-Hero-gated testnet proposal persistence and a fail-closed transaction-preparation endpoint.
- `FixedSupplyLaunchToken`, `LaunchFactory`, `ProRataFairLaunch`, and `ImmutableReferralRegistry` contracts.
- Permissionless failed-launch refunds, oversubscription refunds, incident-pause-to-refund behavior, permissionless unsold-token routing, immutable recipients, and no owner withdrawal.

## Deliberately disabled

No deployment address is bundled. The prepare endpoint refuses to create a transaction until a factory/program address is configured and verified against the audited build hash. Mainnet manifests, Solana mainnet activation, Stock Token pairs, public sale execution, listing submissions, and paid promotion remain closed approval gates.

## HOODED genesis preset

The bundled testnet manifest fixes supply at 1,000,000,000 HOODED and encodes 40% fair launch, 30% game/season rewards, 15% locked liquidity, 10% timelocked DAO, and 5% contributors vesting for 24 months. Its placeholder wallet, URL, content hashes, dates, and media URI must be replaced and independently reviewed before deployment rehearsal.
