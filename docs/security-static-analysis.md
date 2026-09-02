# Static-analysis disposition

The independent follow-up retest of `6fedf40` confirmed R-11, R-14, and R-15 closed, then reported blocking H-5 and M-5. The subsequent candidate addressed those findings and H-6. Launch Bay v1.5 adds the real Robinhood Uniswap v4 adapter, exact coordinator readback, and size-safe component deployers; none of those new changes are closed until an auditor reviews them. Static analysis is supporting evidence, not an audit, and no mainnet transaction may be signed against any candidate commit.

## Slither review

The v1.5 working tree was scanned on 2026-09-01 with Slither across 100 contracts and 102 detectors. It reported 50 heuristic results. The larger contract count includes the pinned Uniswap dependency interfaces/libraries and four production component deployers. Manual review found no newly identified fund-loss or authority path; the dispositions still require independent confirmation.

- Native quote transfers use recipient-owned pull balances. A rejecting recipient can fail only its own withdrawal and cannot block settlement, claims, refunds, or other recipients.
- Exact equality in both factories is an intentional conservation invariant: every fixed-supply token must leave the factory in the declared allocations and the factory balance must be zero.
- Timestamp comparisons define sale, claim, incident, vesting, and mint windows. No timestamp controls randomness.
- Low-level calls are limited to native pull payments and optional referral discovery. Native transfers check success; an unsupported referral registry is treated as unverified. Burns now use a typed interface and verify the exact total-supply decrease.
- Fee harvesting and liquidity finalization are protected by `nonReentrant`; finalization closes before its first external call. The remaining benign reentrancy reports must still be reviewed against the final adapter.
- The exact quote equality proves that only the amount withdrawn from the sale ledger reaches adapter finalization; pre-existing or forced balance is intentionally excluded. Expired quote redirection changes ledger ownership without transferring native currency and leaves `quoteLiability` unchanged.
- The `claimDeadline` comparison intentionally partitions finalization (`<=`) from terminal retirement (`>`); no timestamp permits both paths. The coordinator rejects every hook and independently verifies pool ID, exact sale price, full-range ticks, expected liquidity, NFT ownership, and permanent lock state.
- Divide-before-multiply findings are the intentional Uniswap usable-tick calculation: integer division rounds global tick bounds inward before restoring the configured spacing.
- Adapter strict-equality findings are fail-closed conservation and residue checks. Price and liquidity equalities prevent a declared-but-dishonest adapter from substituting a manipulated or dust position.
- Component deployers are immutable, ownerless, and caller-namespaced. `ProductionLaunchFactory` pins and rechecks their runtime hashes; all five orchestration contracts pass EIP-170 size checks.
- OpenZeppelin pragma variation comes from the pinned `5.4.0` dependency; HOODED contracts compile with exact Solidity `0.8.27`.

## Still required

- Semgrep is not installed in the current workstation environment, so its required release scan is not represented as complete.
- The Robinhood Uniswap v4 adapter is implemented but unaudited. Pool initialization, Permit2 settlement and cleanup, tick math, price encoding, exact-liquidity verification, and the permanent position receipt require independent review before deployment.
- The 2026-09-01 dependency audit reported no known vulnerabilities. Slither's 50 findings require auditor disposition. Semgrep, SBOM, reproducible bytecode evidence, two independent reviews, and an incident/refund drill remain release gates.
