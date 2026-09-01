# Static-analysis disposition

The independent remediation retest of `3a23535` closed the initial Critical and all four High findings, found no new Critical or High issue, and left M-1, M-2, and L-1 partially fixed. Launch Bay v1.3 addresses those three residuals as described in `docs/audit-retest-followup-2026-09-01.md`, but they remain open until the auditor retests the follow-up commit. Static analysis is supporting evidence, not an audit, and no mainnet transaction may be signed against any candidate commit.

## Slither review

The remediation tree was scanned on 2026-09-01 with Slither across 55 contracts and 102 detectors. It reported 33 heuristic results and no newly identified fund-loss or authority path. The dispositions below must still be confirmed by the remediation auditor.

- Native quote transfers use recipient-owned pull balances. A rejecting recipient can fail only its own withdrawal and cannot block settlement, claims, refunds, or other recipients.
- Exact equality in both factories is an intentional conservation invariant: every fixed-supply token must leave the factory in the declared allocations and the factory balance must be zero.
- Timestamp comparisons define sale, claim, incident, vesting, and mint windows. No timestamp controls randomness.
- Low-level calls are limited to native pull payments and optional referral discovery. Native transfers check success; an unsupported referral registry is treated as unverified. Burns now use a typed interface and verify the exact total-supply decrease.
- Fee harvesting and liquidity finalization are protected by `nonReentrant`; finalization closes before its first external call. The remaining benign reentrancy reports must still be reviewed against the final adapter.
- OpenZeppelin pragma variation comes from the pinned `5.4.0` dependency; HOODED contracts compile with exact Solidity `0.8.27`.

## Still required

- Semgrep is not installed in the current workstation environment, so its required release scan is not represented as complete.
- The Robinhood Uniswap v4 adapter is intentionally absent until its pool initialization, Permit2 settlement, tick math, price encoding, and position receipt path receive independent review.
- The 2026-09-01 dependency audit reported no known vulnerabilities. Slither must be rerun against the final frozen commit and adapter dependency tree. Semgrep, SBOM, reproducible bytecode evidence, two independent reviews, and an incident/refund drill remain release gates.
