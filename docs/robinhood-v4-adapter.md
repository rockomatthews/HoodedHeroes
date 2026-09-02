# Robinhood Uniswap v4 adapter candidate

Status: **v1.7 H-7 remediation implemented, locally integrated, awaiting follow-up audit, not authorized for deployment**.

## Immutable venue configuration

- Chain: Robinhood Chain `4663`
- WETH: `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73`
- PoolManager: `0x8366a39CC670B4001A1121B8F6A443A643e40951`
- PositionManager: `0x58daec3116aae6D93017bAAea7749052E8a04fA7`
- Permit2: `0x000000000022D473030F116dDEE9F6B43aC78BA3`
- Static LP fee: `3000` (`0.30%`)
- Tick spacing: `60`
- Hook: the adapter itself, CREATE2-mined with only Uniswap's `beforeInitialize` flag
- Position range: greatest usable tick at or inside each Uniswap v4 global tick boundary

The adapter constructor verifies that PositionManager reports the configured PoolManager and Permit2. It also pins one exact `ProductionLaunchFactory`, that factory's exact `ProductionLiquidityDeployer`, and the deployer's runtime code hash. Every constructor value is immutable and therefore included in the adapter runtime bytecode hash pinned by `ProductionLaunchFactory` and `RobinhoodLiquidityCoordinator`.

The component deployer permanently records which factory created every coordinator; its separate pending binding is consumed when the sale is attached. Before accepting any tokens or native quote, the adapter requires the caller to have been created by its exact factory, then independently matches the coordinator's adapter, launch token, permanent position receiver, and sale proceeds recipient. The receiver must report this adapter and the pinned PositionManager and must still be unlocked. A public token holder, direct-allocation holder, or coordinator created by any other caller therefore cannot initialize the canonical pool through the shared adapter.

This is an intentional release boundary: one adapter belongs to one production factory. A new factory version requires a newly mined and independently reviewed adapter. The adapter address, factory, component deployer, CREATE2 salt, init-code hash, and all runtime hashes must be frozen together; mixing releases would create an unfinalizable launch.

`RobinhoodUniswapV4AdapterDeployer` is the ownerless production deployment path. Mine the CREATE2 salt off-chain against that deployer's confirmed address and the complete adapter init code, require the predicted address to carry exactly `BEFORE_INITIALIZE_FLAG`, and then call `deploy`. The adapter constructor repeats the flag check and fails closed. Record the deployer, salt, adapter address, init-code hash, and runtime-code hash; never mine on-chain or assume a CREATE2 deployer exists on chain without readback.

Launch Bay v1.5 also replaces the oversized monolithic production factory with four immutable component deployers. Their CREATE2 salts include the calling factory address, preventing another caller from consuming its deterministic addresses. The factory pins and rechecks each component runtime hash before launch creation. Current optimized runtime sizes are: factory `10,292`, liquidity deployer `16,656`, sale deployer `18,371`, token deployer `3,735`, and vesting deployer `2,283` bytes; all are below EIP-170's `24,576`-byte limit.

## Finalization flow

1. Authenticate the calling coordinator through permanent factory/deployer provenance and validate its launch, receiver, and proceeds bindings before moving assets.
2. Pull exactly the coordinator-approved launch-token amount. Wrap the complete native balance so a forced donation cannot block finalization; only `msg.value` participates in pricing.
3. Sort launch token and WETH into the canonical v4 `PoolKey`.
4. Derive `sqrtPriceX96` from the settled token/native ratio.
5. Gate initialization through `beforeInitialize`, accepting only the pinned PoolManager when its original sender is the adapter. Then initialize at the exact price, or reject an existing mismatch.
6. Compute full-range liquidity with Uniswap's `LiquidityAmounts` and `TickMath` libraries.
7. Grant exact ERC20-to-Permit2 and Permit2-to-PositionManager allowances.
8. Execute `MINT_POSITION` with explicit maximum token inputs followed by `SETTLE_PAIR`. The deprecated delta-derived mint action is not used.
9. Clear both allowance layers and verify they read zero.
10. Verify the predicted NFT owner and exact position liquidity, then register the NFT in the ownerless permanent receiver.
11. Return launch-token rounding residue to the coordinator for verified burning and send wrapped-native residue to the immutable sale proceeds recipient. Require all adapter balances to be zero.

## Coordinator verification

The coordinator does not accept the adapter descriptor as proof. It independently:

- reconstructs the adapter-hook `PoolKey` and pool ID; the adapter constructor enforces that its mined address carries only `beforeInitialize`;
- recomputes the exact sale-derived `sqrtPriceX96`;
- reads PoolManager slot state through Uniswap `StateLibrary`;
- requires the position to use the full usable tick range;
- recomputes expected liquidity from the complete sale amounts;
- requires PositionManager's position liquidity to equal that amount;
- verifies NFT ownership and the permanent receiver's immutable receipt; and
- stores the verified price and liquidity alongside the canonical descriptor.

This closes the malicious self-attestation case where an adapter claims price protection while minting dust or no useful liquidity.

## Fork evidence

`RobinhoodUniswapV4LiquidityAdapterFork.t.sol` is opt-in and never broadcasts. With `RUN_MAINNET_FORK_TESTS=true` and the server-side `RH_RPC_URL`, it verifies:

- canonical constructor bindings;
- actual PoolManager initialization;
- actual Permit2 settlement and allowance cleanup;
- direct PositionManager NFT mint and permanent lock;
- exact pool-price readback;
- rejection of a conflicting existing-pool price;
- rejection of outsider and direct initialization-hook calls, plus absence of an unlock callback; and
- the complete fixed-price fair-sale settlement through coordinator finalization.

The 2026-09-01 local rehearsal passed all three adapter fork tests at Robinhood block `52,172,883`. The block number is evidence only and must not be reused as a deployment assumption.

## Remaining release gates

- Independent review of the adapter, coordinator changes, imported Uniswap dependency versions, and compiled bytecode.
- Auditor rerun of H-7/X-2/X-2b, C-2, and every prior PoC against the v1.7 candidate.
- Independent confirmation that permanent deployer provenance cannot be forged, overwritten, or confused across factories, and that every valid production coordinator still finalizes.
- Slither, Semgrep, SBOM, dependency-license, and reproducible-build evidence on the frozen commit.
- Fresh runtime-code-hash and chain-ID readback immediately before any approved canary.
- Decoded unsigned simulation and explicit transaction-level approval.
- Successful owner-only canary followed by on-chain pool, price, liquidity, allowance, balance, and NFT-lock readback.

No deployment, transaction broadcast, provider-support claim, or audit claim is made by this implementation.
