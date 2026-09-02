# Robinhood Chain Uniswap readback

Read-only QuickNode evidence refreshed on 2026-08-31 at Robinhood Chain block `51,454,759` (chain ID `4663`). Re-run `pnpm production:uniswap-readback:rh` immediately before any deployment and compare every address and runtime hash; this record is evidence, not permission to broadcast.

| Contract | Address | Runtime Keccak-256 |
|---|---|---|
| WETH | `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73` | `0x5706be52f64875fee65a2cec0d80e47a23d8793cbe85d214b48445e2d05f5353` |
| Uniswap v4 PoolManager | `0x8366a39cc670b4001a1121b8f6a443a643e40951` | `0xbd3881180b547f5fe817545743cfb4343e96b1bc6640dcd70c106b0066e95626` |
| Uniswap v4 PositionManager | `0x58daec3116aae6d93017baaea7749052e8a04fa7` | `0xc873e135dc9aaec88489cfbad146b4cb49d6a32e0d80326377784b7ba17670b2` |

The addresses come from the official [Uniswap chain 4663 deployment registry](https://github.com/Uniswap/contracts/blob/main/deployments/4663.md). Robinhood separately publishes the canonical [WETH address](https://docs.robinhood.com/chain/contracts/). The production transaction preparer rejects any other manager address and requires live runtime hashes for WETH, PoolManager, PositionManager, the HOODED adapter, factory, Hero reward vault, and DAO timelock. Community vesting vaults are created deterministically by the production factory and must be verified from the resulting launch receipt.

The HOODED v1.5 v4 adapter now implements exact sale-price initialization, a zero-hook full-range position, Permit2 settlement and same-transaction allowance cleanup, permanent NFT receipt, and residue removal. A local QuickNode-backed fork exercised both the adapter and the complete sale-to-canonical-pool path against these deployed contracts. The source, frozen bytecode, and fork evidence still require independent review; manager-address verification and a passing internal test are not an audit or deployment authorization.
