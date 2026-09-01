# Launch Bay v1 implementation

Launch Bay v1.1 is a fixed-price, timed, pro-rata fair-launch candidate for Robinhood Chain. `LaunchManifestV1.1` drives UI validation, simulation, metadata, APIs, and contract configuration. HOODED does not use public testnets: evidence comes from local tests, mainnet forks, unsigned simulations, two owner-only lab launches, and independent review.

## Implemented foundations

- Fourteen deterministic manifest gates, including launch classification, a bound creator, fixed supply, exact allocation conservation, approved quote assets, 1% fee cap, a published Hero reward vault, immutable authority flags, production liquidity or lab no-pool enforcement, EIP-712 contribution eligibility, metadata completeness, reproducible source hashes, and sealed execution.
- Shared pro-rata allocation simulator with integer rounding equivalent to the EVM contract.
- Metaplex, Uniswap Token List, and DEX Screener payload generation from one versioned metadata record.
- Public launch list/detail/validation/simulation endpoints.
- Signed-wallet owner-gated canary persistence and a fail-closed transaction-preparation endpoint.
- Burnable `FixedSupplyLaunchToken`, owner-only `LaunchFactory`, Safe-approved `ProductionLaunchFactory`, `ProRataFairLaunch`, `RobinhoodLiquidityCoordinator`, ownerless position receiver, and immutable referral registry.
- Production approvals and participant eligibility are EIP-712 signatures bound to chain, contract, wallet, manifest, nonce, allowance, and expiration. Claims and refunds never require eligibility approval.
- Accepted quote is split during settlement. For HOODED, 37.5% enters the liquidity coordinator, the disclosed fee follows its immutable split, and the remainder accrues to the DAO timelock.
- Permissionless failed-launch refunds, oversubscription refunds, incident-pause-to-refund behavior, settlement on behalf of inactive contributors, immutable recipients, and no owner withdrawal. Quote proceeds, fees, and refunds use recipient-owned pull balances, so a recipient that rejects ETH cannot block anyone else's settlement. Unsold tokens cannot move until every contribution has settled.
- Owner-only unsigned creation and activation preparation routes with exact factory/sale bytecode checks, immutable-owner readback, manifest-hash checks, gas estimation, and required mainnet `eth_call` simulation.
- Launch preparation requires the manifest reward recipient, submitted execution recipient, and server-configured chain reward vault to match exactly. The reward vault can permissionlessly pull its accrued sale-fee balance into a new equal-per-Hero round; native fees are wrapped before accounting.
- Public `GET /api/rewards/hero-rounds` analytics read all totals at one block and expose funded value, outstanding liability, delivered value, carry, vault balance, per-Hero index, round count, eligible supply, and reconciliation status without exposing the RPC endpoint.

## Deliberately disabled

No deployment address is bundled. Lab and production prepare endpoints refuse to create unsigned transactions until their factories, reward vault, approval signer, liquidity adapter, position manager, manifests, and runtime hashes match. They never broadcast. Solana activation, Base production, Stock Token pairs, public sale activation, listing submissions, and paid promotion remain closed approval gates.

## HOODED genesis preset

The bundled production manifest fixes supply at 1,000,000,000 HOODED and encodes 40% fair launch, 30% game/season rewards, a maximum 15% liquidity allocation, 10% timelocked DAO, and 5% community grants vesting for at least 24 months. Price is 0.000000025 ETH per HOODED, the raise is 0.25–10 ETH, the wallet cap is 0.1 ETH, and the window lasts 72 hours. Partial raises scale liquidity at the same price and burn unused liquidity and sale supply.

Genesis Heroes reserve Recruit IDs 1–10 as a free, immediately transferable founder grant inside the 3,000 cap. Public inventory is 2,190 Recruits, 600 Specialists, 180 Vanguards, and 20 Icons. The founder wallet cannot also use the public primary mint.

## Mainnet canary sequence

`Draft → Metadata Validated → Sandbox Passed → Peer Reviewed → Security Approved → Fork Proven → Simulation Passed → Canary Ready → Mainnet Verified → Public Eligible`

The canary factory has one immutable creator. Every new sale is sealed at creation and requires a separate creator-signed activation transaction. A later public release uses a newly reviewed factory version; the canary factory never becomes permissionless.

Mainnet-fork tests are opt-in and read-only. Set `RUN_MAINNET_FORK_TESTS=true` with the relevant RPC URLs, then run the Foundry suite. Fork tests deploy only into the local ephemeral fork and never broadcast or spend funds.

For Robinhood Chain, keep the QuickNode URL in the ignored `.env` file as `RH_RPC_URL`. Run `pnpm canary:rpc-check` to verify chain ID `4663`, latest-block freshness, and read latency without printing the endpoint. Run `pnpm canary:fork:rh` to perform the same preflight and then execute the opt-in ephemeral fork rehearsal. Neither command accepts a private key or broadcasts.

After setting `LAUNCH_CANARY_OWNER_ADDRESS`, run `pnpm canary:factory-plan:rh` to compile the reviewed factory and calculate its current gas estimate, maximum cost at the reported gas price, deployer balance readiness, pending-nonce deployment address, creation/runtime code hashes, and init-code hash. Set `RH_FACTORY_DEPLOYER_ADDRESS` when the funding/deployment wallet differs from the immutable canary owner, such as a Safe-controlled owner with a dedicated deployer. The planner contains no private-key input and has no broadcast path; changing the deployer's pending nonce changes the predicted address, so regenerate immediately before any separately approved deployment.

Run `pnpm canary:evidence` to rebuild the Solidity suite and print a reproducible evidence record containing the source commit, compiler settings, ABI hashes, bytecode hashes, and byte sizes. Use `node scripts/canary-build-evidence.mjs --require-clean` for release evidence.

The current Slither review leaves explicit findings for intentional timestamp windows, the caller-only native-asset withdrawal, exact fixed-supply allocation conservation, low-level referral-registry detection, OpenZeppelin pragma variation, the constructor-bound wrapped-native deposit, and conservative reentrancy heuristics around guarded fee harvesting. The pull-payment design has a hostile-recipient regression test; the harvester requires the immutable recipient, matching quote asset, exact accrued/withdrawn amount, post-transfer balance reconciliation, and a reentrancy guard. These findings require independent auditor review before a mainnet signature; static analysis is not an audit.

## Metadata cost discipline

The token stores only its fixed supply and one immutable `bytes32` manifest hash in addition to standard ERC-20 identity. Descriptions, artwork, social links, media dimensions, and distribution payloads remain in the signed content-addressed publication package. This keeps token creation gas bounded while preserving a verifiable link to complete metadata.

Metadata revisions use recursively key-sorted canonical JSON. The revision SHA-256 excludes only its own `contentHash` field; Launch Bay recomputes and verifies that digest before persistence or unsigned transaction preparation. The complete manifest then receives its canonical database SHA-256 and on-chain Keccak-256 commitment, preventing publication edits from silently retaining old evidence.
