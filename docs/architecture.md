# Architecture

## Trust boundaries

```text
wallet -> SIWE challenge -> gated session -> web UI
                                      |
                                      v
                         signed score session
                                      |
Canvas action trace -> score verifier -> atomic nonce reservation -> season ledger
                                                               |
                                                               v
                                                   immutable reward manifest
```

The browser is never authoritative for score, wallet balance, ownership, rank, or rewards. Power Grid emits only a deterministic seed plus action trace. The score service verifies the trace and signs the accepted result. A PostgreSQL transaction must reserve the session nonce before inserting the score; the API currently reports this missing persistence step rather than pretending to credit a reward.

## Access policy

| State | Access |
| --- | --- |
| Public | Vestibule, disclosures, verified contract links, acquisition and mint guidance |
| Holds 25,000 HERO | Preview lobby |
| Owns a HoodedHero | Missions, Code Bazaar, Assembly, Launch Bay |

The production SIWE callback must snapshot both token balance and NFT ownership from Robinhood Chain. NFT ownership is the durable membership check, so a member remains admitted after spending HERO to mint. Transfers trigger an on-chain progression-reset event; the indexer applies the reset to earned progression.

## Deployment boundaries

The Next.js app and score endpoints are Vercel-compatible. PostgreSQL, the chain indexer, and queue-based season settlement remain external services. Secrets stay server-side. Safe signers and timelocks are configuration dependencies, not browser accounts.
