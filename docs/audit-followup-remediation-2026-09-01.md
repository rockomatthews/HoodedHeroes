# HOODED Launch Bay H-5 / M-5 remediation candidate

The independent follow-up retest of commit `6fedf40333ac4415379ecee66395e19ad1bf2511` closed R-11, R-14, and R-15, then reported H-5 and M-5. This document records the local remediation candidate. It is not an audit closure or deployment approval.

## H-5 — force-fed native balance

`RobinhoodLiquidityCoordinator.finalize()` no longer reads `address(this).balance` to determine liquidity size. It snapshots `sale.claimableQuote(address(this))`, withdraws that exact amount atomically, verifies the balance delta, and derives the token amount only from the accounted quote. Native currency forced into the coordinator before or after CREATE2 deployment is excluded.

The prior public standalone harvest path was removed. A failed adapter call reverts the quote withdrawal together with the rest of finalization, leaving the quote in the sale's pull-payment ledger.

After `claimDeadline`, `retireFailedLaunch()` is a cause-independent terminal escape hatch. It burns the unfinalized liquidity token allocation and calls `redirectExpiredLiquidityQuoteToProceeds()`, which moves the coordinator's accrued quote to the immutable DAO proceeds recipient without changing `quoteLiability` or transferring funds during settlement.

Local evidence:

- Force-fed native currency after deployment is ignored and finalization succeeds.
- One wei sent to the predicted CREATE2 coordinator before deployment survives but is ignored and finalization succeeds.
- A deliberately fail-closed adapter can be terminally retired after the claim deadline; the token allocation burns and accounted quote is conserved in the sale ledger.
- Only the immutable liquidity recipient can redirect, only after the claim deadline, and total quote liability is unchanged.

## M-5 — past vesting start

`ProductionLaunchFactory` now requires `saleConfig.endsAt > block.timestamp` before any token, coordinator, sale, or vesting vault is deployed. A creator cannot approve a launch whose 730-day vesting term already elapsed.

## Required follow-up

The auditor must retest these changes and the v1.4 canonical pool interface. The production Robinhood Uniswap v4 adapter is still absent and requires a separate implementation audit, callback/price-manipulation tests, runtime-code-hash readback, and mainnet-fork canary before any deployment.

## v1.4 interface compatibility disclosure

The v1.4 adapter return type and coordinator constructor are source-incompatible with the three earlier external PoC files. The auditor's adapted `*.v14.t.sol` copies changed only mock return types/security declarations, the new leading `manifestHash` constructor argument, and the matching CREATE2 encoding. No exploit assertion or sequence changed. External adapters, direct coordinator deployers, and test harnesses must update in lockstep.

## H-6 follow-up

The first terminal recovery candidate allowed healthy finalization and destructive retirement to overlap after `claimDeadline`. The current candidate closes `finalize()` after `claimDeadline`; terminal retirement opens only when `block.timestamp > claimDeadline`. Boundary tests prove retirement is unavailable while finalization remains open at the deadline, and finalization is unavailable once retirement opens.

Adapter `securityConfiguration()` remains self-attestation, not proof of price protection or callback correctness. The descriptor `hook` remains adapter-reported and unconstrained by the coordinator. Both limitations, plus the web registry and indexer, require separate review before canonical pool data is treated as authoritative.
