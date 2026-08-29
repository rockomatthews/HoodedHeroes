# Security and Launch Bay gates

Launch Bay is intentionally absent from the executable prototype. It must never compile or execute arbitrary community uploads.

A Robinhood Chain v1 template may proceed only after static analysis, fuzz and invariant testing, reproducible builds, independent review, hero voting, and security-council approval. Templates enforce one-time fixed supply, creator allocation at or below 10%, at least 12-month creator vesting, contribution caps, minimum raise, refunds, locked liquidity, published source, explicit roles, and immutable transfer behavior.

No contract may contain a hidden mint, blacklist, mutable transfer tax, owner withdrawal from reward vaults, or liquidity escape hatch. Robinhood Chain comes first; Base and Solana require separate audits and releases.

## Remaining production exercises

- Threat model SIWE, indexer reorgs, replay races, compromised score keys, and eligibility revocation.
- Property-test supply caps, receipt splits, funded-vault bounds, contribution refunds, vesting, and locked liquidity.
- Run Safe signer-loss, timelock cancellation, incident pause, and indexer-recovery drills.
- Complete independent contract, application, economic, and legal review before mainnet.
