# Launch Bay remediation-retest follow-up

> Superseded for deployment review by `docs/audit-followup-remediation-2026-09-01.md`. The M-1 sizing gate described below remains correct for accrued quote, but the auditor found H-5 because the coordinator previously sized from raw native balance. No deployment is authorized.

The independent retest of commit `3a23535db3e287225e1daaff58f737e101a5e73b` closed C-1 and H-1 through H-4, confirmed no new Critical or High issue, and classified M-1, M-2, and L-1 as partially fixed. This v1.3 follow-up addresses those residuals. It is a retest candidate, not deployment approval.

## Residual remediation

| Finding | v1.3 change | Regression evidence |
|---|---|---|
| M-1 — undersized liquidity allocation | The production factory derives the maximum native liquidity quote from `maximumRaise` and `liquidityShareBps`, price-matches it with `pricePerToken`, and rejects a smaller token allocation. | A 149-token allocation for a configuration requiring 150 reverts `liquidity allocation too small`; the exact 150-token configuration completes settlement and finalization. |
| M-2 — presence-only vesting | The production factory requires the aggregate vested allocation to be between 5% and 10% of fixed supply. Every vault still requires at least 730 days, and vesting now starts at `saleConfig.endsAt`. | One wei vested reverts `vested allocation too small`; 10.1% reverts `vested allocation too large`; the 5% HOODED policy deploys funded and begins at sale end. |
| L-1 — older permit restores allowance | Eligibility nonces must increase monotonically for each contributor, so presenting a correction automatically makes every lower nonce stale. The immutable signer can also proactively raise a contributor-specific nonce floor. | After Alice presents the corrected nonce-2 allowance, the older nonce-1 high allowance reverts `stale eligibility nonce`. A signer-raised floor independently rejects revoked permits. |

## Policy recorded

- Production templates reserve 5–10% of supply for on-chain vesting. HOODED uses exactly 5% for community contribution grants.
- The 730-day clock begins when the sale ends, so no vesting time is consumed while a sealed launch waits or while contributions are open.
- Presenting a newer permit automatically invalidates older nonces. The signer can proactively raise the on-chain nonce floor before a corrected permit is presented; short permit deadlines remain required operational hygiene.
- Liquidity allocation sufficiency is enforced before the factory deploys or distributes the token. The final Uniswap v4 adapter must still enforce its own price, slippage, callback, Permit2, and position-receipt invariants.

## Retest request

The auditor should rerun `RemediationRetest.t.sol`, confirm that R-11, R-14, and R-15 no longer reproduce, review the new regression tests, and report whether M-1, M-2, and L-1 are closed. The Uniswap v4 adapter remains unimplemented and outside this follow-up.
