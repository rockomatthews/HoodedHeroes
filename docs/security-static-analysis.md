# Static-analysis disposition

The v1.5 adapter audit closed H-6/N-3/N-4 but reported blocking C-2 and H-7. Launch Bay v1.6 consumes force-fed native value without pricing it and gates pool initialization through the adapter's mined `beforeInitialize` hook. These changes require follow-up audit. Static analysis is supporting evidence, not an audit, and no mainnet transaction may be signed against any candidate commit.

## Slither review

The v1.6 working tree was scanned on 2026-09-01 with Slither across 104 contracts and 102 detectors. It reported 49 heuristic results. The prior true-positive native-balance equality is gone; remaining strict-equality reports cover accounted conservation or balances the adapter actively transfers. The dispositions still require independent confirmation.

- Native quote transfers use recipient-owned pull balances. A rejecting recipient can fail only its own withdrawal and cannot block settlement, claims, refunds, or other recipients.
- Exact equality in both factories is an intentional conservation invariant: every fixed-supply token must leave the factory in the declared allocations and the factory balance must be zero.
- Timestamp comparisons define sale, claim, incident, vesting, and mint windows. No timestamp controls randomness.
- Low-level calls are limited to native pull payments and optional referral discovery. Native transfers check success; an unsupported referral registry is treated as unverified. Burns now use a typed interface and verify the exact total-supply decrease.
- Fee harvesting and liquidity finalization are protected by `nonReentrant`; finalization closes before its first external call. The remaining benign reentrancy reports must still be reviewed against the final adapter.
- The exact quote equality proves that only the amount withdrawn from the sale ledger reaches adapter finalization; pre-existing or forced balance is intentionally excluded. Expired quote redirection changes ledger ownership without transferring native currency and leaves `quoteLiability` unchanged.
- The `claimDeadline` comparison intentionally partitions finalization (`<=`) from terminal retirement (`>`); no timestamp permits both paths. The coordinator accepts only the pinned adapter as the initialization hook, while the adapter constructor enforces its sole address flag, and independently verifies pool ID, exact sale price, full-range ticks, expected liquidity, NFT ownership, and permanent lock state.
- Divide-before-multiply findings are the intentional Uniswap usable-tick calculation: integer division rounds global tick bounds inward before restoring the configured spacing.
- Price and liquidity equalities apply only after guarded initialization. The adapter wraps its complete native balance, so forced value cannot falsify the final zero-residue assertion; only `msg.value` is used for price and liquidity.
- Component deployers are immutable, ownerless, and caller-namespaced. `ProductionLaunchFactory` pins and rechecks their runtime hashes; all five orchestration contracts pass EIP-170 size checks.
- HOODED source pragmas accept Solidity `0.8.26`; Foundry auto-detection compiles the local integration against Uniswap's exact `0.8.26` PoolManager and PositionManager.

## Still required

- Semgrep is not installed in the current workstation environment, so its required release scan is not represented as complete.
- The Robinhood Uniswap v4 adapter has been audited but is not cleared; C-2/H-7 remediation and the new initialization callback require follow-up review. Pool initialization, Permit2 settlement and cleanup, tick math, price encoding, exact-liquidity verification, and the permanent position receipt require independent review before deployment.
- The 2026-09-01 dependency audit reported no known vulnerabilities. Slither's 49 findings require auditor disposition. Semgrep, SBOM, reproducible bytecode evidence, two independent reviews, and an incident/refund drill remain release gates.
