# Launchpad pattern study: StonkBrokers and Mancer

Research snapshot: 2026-08-29. This is a product and integration study, not an endorsement or a source-code license analysis.

## What exists today

### StonkBrokers

Stonk Launcher exposes a public token registry and token/trade feeds, bonding-curve trading, visible graduation into locked liquidity, fee routing, community curation, and developer integration material. Its documented lifecycle is create → sale → finalize, with liquidity, fee splitter, and staking infrastructure created at finalization.

The system also connects a finite NFT collection to token-gated activation, tiered rewards, governance, and protocol identity. The useful design lesson is that the NFT is not merely artwork: it is the durable member account and access object around which protocol participation is organized.

Important license boundary: the StonkBrokers documentation identifies its protocol and launchpad code as BUSL 1.1 and explicitly withholds competitive production-use rights before its change date. HoodedHeroes may study public behavior and integrate public interfaces where permitted, but must not copy or deploy its licensed contracts.

Primary references:

- https://www.stonkbrokers.cash/docs
- https://stonkbrokers.wtf/developers
- https://www.stonkbrokers.cash/launcher

### Mancer

Mancer is an aggregator rather than a launchpad. Its strongest reusable interaction patterns are route competition across live venues, split routing, net-of-fee quotes, an on-chain minimum-received floor, non-custodial signed orders, all-or-nothing limit execution, stop/OCO controls, recurring schedules, free off-chain cancellation, and an executable quote API for integrators.

The useful lesson for HoodedHeroes is the intent model: builders sign a bounded proposal, assets and authority remain with the signer until execution, and every executor must honor the signed floor. That maps well to launch proposals, review approvals, and future treasury actions.

Primary references:

- https://mancer.xyz/docs
- https://mancer.xyz/status
- https://mancer.xyz/stats

## Common product functions worth adopting

| Pattern | HoodedHeroes translation |
|---|---|
| Discoverable registry | Launch Bay project grid with new, review, testnet, graduated, and rejected filters |
| Transparent lifecycle | Draft → Code Bazaar → analysis/fuzz → independent review → hero vote → council → testnet |
| Visible thresholds | Minimum raise, contribution cap, graduation threshold, allocation chart, and funded-liquidity status |
| Non-custodial intent | EIP-712 proposal and approval signatures; no token or treasury movement when drafting |
| Executable previews | Deterministic transaction simulation with net amounts, slippage/floor, roles, and exact contract bytecode hash |
| Community curation | Hero voting after objective security gates pass; popularity cannot override a failed invariant |
| Integrator API | Versioned read-only registry, proposal status, simulations, audit artifacts, and event feeds |
| Activity flywheel | Launch activity can fund seasons and builder rewards only through published, capped fee rules |
| Permanent liquidity commitment | Launch templates transfer liquidity positions to a no-withdraw locker or provably burn control |
| Durable member identity | A HoodedHero grants builder access and carries reputation; transfer resets earned progression |

## Explicit non-goals

- No copy or deployment of StonkBrokers BUSL contracts.
- No public arbitrary-contract uploads.
- No hidden mint, blacklist, owner withdrawal, mutable tax, upgrade key, or liquidity escape hatch.
- No stock-token launch pairs or claims until identity, jurisdiction, sanctions, and asset-specific legal review are operational.
- No popularity vote can bypass static analysis, fuzzing, reproducible builds, independent review, or Security Council approval.

## HoodedHeroes v1 implementation

The Launch Bay interface now implements an original proposal validator shared across the app. It supports safe-fixed and fair-curve proposal modes, HERO or ETH quote assets, immutable supply, allocation controls, minimum raise, graduation threshold, wallet caps, twelve-month creator vesting, and permanent-liquidity requirements.

The interface is a simulation and review surface. It does not deploy contracts or accept funds. The production execution layer remains separately gated behind authenticated heroes, Vercel Sandbox isolation for build/test work, audited Solidity templates, Safe/timelock approvals, and Robinhood Chain testnet rehearsal.
