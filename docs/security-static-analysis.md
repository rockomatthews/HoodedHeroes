# Static-analysis disposition

This source snapshot passed the local Solidity test and fuzz suite and was scanned with Slither on 2026-08-31. Static analysis is supporting evidence, not an audit. No mainnet transaction may be signed until two independent contract reviews have dispositioned these items against the final bytecode.

## Slither review

- Native quote transfers use recipient-owned pull balances. A rejecting recipient can fail only its own withdrawal and cannot block settlement, claims, refunds, or other recipients.
- Exact equality in both factories is an intentional conservation invariant: every fixed-supply token must leave the factory in the declared allocations and the factory balance must be zero.
- Timestamp comparisons define sale, claim, incident, vesting, and mint windows. No timestamp controls randomness.
- Low-level calls are limited to native pull payments, optional referral discovery, and holder-initiated `burn(uint256)` on the fixed factory token. Each path checks success or treats an unsupported referral registry as unverified.
- Fee harvesting and liquidity finalization are protected by `nonReentrant`; finalization closes before its first external call. The remaining benign reentrancy reports must still be reviewed against the final adapter.
- OpenZeppelin pragma variation comes from the pinned `5.4.0` dependency; HOODED contracts compile with exact Solidity `0.8.27`.

## Still required

- Semgrep is not installed in the current workstation environment, so its required release scan is not represented as complete.
- The Robinhood Uniswap v4 adapter is intentionally absent until its pool initialization, Permit2 settlement, tick math, price encoding, and position receipt path receive independent review.
- Slither must be rerun against the frozen commit and final dependency tree. Semgrep, dependency audit, SBOM, reproducible bytecode evidence, two independent reviews, and an incident/refund drill remain release gates.
