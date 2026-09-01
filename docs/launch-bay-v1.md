# Launch Bay v1 implementation

Launch Bay v1 is a fixed-price, timed, pro-rata fair-launch mainnet-canary candidate. The canonical `LaunchManifestV1` drives UI validation, simulation, public metadata, APIs, and contract configuration for Robinhood Chain, Base, and the staged Solana adapter. HOODED does not use public testnets: evidence comes from local tests, mainnet forks, unsigned simulations, and a sealed owner-only canary.

## Implemented foundations

- Thirteen deterministic manifest gates, including a bound canary creator, fixed supply, exact allocation conservation, approved chain quote assets, 1% fee cap, immutable authority flags, permanent liquidity, metadata completeness, reproducible source hashes, and sealed owner-only execution.
- Shared pro-rata allocation simulator with integer rounding equivalent to the EVM contract.
- Metaplex, Uniswap Token List, and DEX Screener payload generation from one versioned metadata record.
- Public launch list/detail/validation/simulation endpoints.
- Signed-wallet owner-gated canary persistence and a fail-closed transaction-preparation endpoint.
- `FixedSupplyLaunchToken`, `LaunchFactory`, `ProRataFairLaunch`, and `ImmutableReferralRegistry` contracts.
- Permissionless failed-launch refunds, oversubscription refunds, incident-pause-to-refund behavior, settlement on behalf of inactive contributors, immutable recipients, and no owner withdrawal. Unsold tokens cannot move until every contribution has settled.
- Owner-only unsigned creation and activation preparation routes with exact factory/sale bytecode checks, immutable-owner readback, manifest-hash checks, gas estimation, and required mainnet `eth_call` simulation.

## Deliberately disabled

No deployment address is bundled. The prepare endpoint refuses to create an unsigned transaction until the configured mainnet factory bytecode, immutable canary owner, manifest lifecycle, and full call simulation all match. It never broadcasts. Solana activation, Stock Token pairs, public sale activation, listing submissions, and paid promotion remain closed approval gates.

## HOODED genesis preset

The bundled mainnet-canary manifest fixes supply at 1,000,000,000 HOODED and encodes 40% fair launch, 30% game/season rewards, 15% locked liquidity, 10% timelocked DAO, and 5% contributors vesting for 24 months. Its placeholder wallet, content hashes, dates, and media URI must be replaced and independently reviewed before any owner signature.

## Mainnet canary sequence

`Draft → Metadata Validated → Sandbox Passed → Peer Reviewed → Security Approved → Fork Proven → Simulation Passed → Canary Ready → Mainnet Verified → Public Eligible`

The canary factory has one immutable creator. Every new sale is sealed at creation and requires a separate creator-signed activation transaction. A later public release uses a newly reviewed factory version; the canary factory never becomes permissionless.

Mainnet-fork tests are opt-in and read-only. Set `RUN_MAINNET_FORK_TESTS=true` with the relevant RPC URLs, then run the Foundry suite. Fork tests deploy only into the local ephemeral fork and never broadcast or spend funds.

## Metadata cost discipline

The token stores only its fixed supply and one immutable `bytes32` manifest hash in addition to standard ERC-20 identity. Descriptions, artwork, social links, media dimensions, and distribution payloads remain in the signed content-addressed publication package. This keeps token creation gas bounded while preserving a verifiable link to complete metadata.
