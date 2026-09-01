# OTCDesks pattern study

Research snapshot: 2026-08-31. Sources reviewed: the live [OTCDesks product](https://otcdesks.cash/), [protocol documentation](https://otcdesks.cash/docs), [launcher](https://otcdesks.cash/launcher), [analytics](https://otcdesks.cash/analytics), and [round history](https://otcdesks.cash/history). No public source repository or license authorizing contract reuse was located, so HOODED uses an independent AGPL implementation and does not copy their code, visual identity, names, or text.

## Strong patterns

| OTCDesks pattern | Why it works | HOODED adaptation |
|---|---|---|
| NFT-bound vault history | Unclaimed value travels with the membership NFT instead of becoming stranded at an old wallet | Universal reward rights attach to each Genesis Hero token ID and pay its current owner |
| Global counter minus per-NFT stamp | A reward round updates one number instead of looping over thousands of NFTs | `HeroRoundRewardVault` funds a round in O(1); first claim finds the Hero's entry counter by binary search, then future claims are O(1) |
| Permissionless delivery | An inactive holder cannot strand settlement | Anyone may trigger a Hero claim, but payment always goes to the current NFT owner |
| Deferred activation without lost accrual | Operational setup can happen later without forfeiting prior entitlement | No activation transaction is required; sequential Hero mint supply determines the first eligible round |
| Rounding dust rollover | Tiny uneconomic amounts are not silently discarded | Integer remainder becomes the next round's carry |
| Append-only reward expansion | New reward types do not require rewriting old vaults | Separate versioned reward vaults can be added without changing existing Hero accounting |
| Fee flywheel after sellout | Recurring fees continue funding utility after primary minting ends | Launch Bay fee shares can fund universal Hero rounds after all 3,000 Heroes are minted, subject to an immutable manifest |
| Public funded/waiting/delivered analytics | Users can reconcile marketing claims against actual balances | Expose `totalFunded`, `claimLiability`, `carry`, `totalDelivered`, checkpoints, and reward-token balances |
| Explicit refund history | Corrections and dilution are visible rather than buried | Every exceptional allocation or remediation requires a public manifest, transaction evidence, and quantified holder impact |

## Improvements and boundaries

- HOODED never grants replacement Heroes as an informal refund mechanism. The 3,000 cap and tier caps remain immutable.
- New Heroes do not receive rounds funded before they existed. Existing Heroes keep equal weight regardless of origin tier.
- Unclaimed universal rewards deliberately follow a transferred Hero. The interface must disclose that behavior before transfer.
- Universal reward vaults may hold ordinary ERC-20 assets approved by governance and security review. Regulated Stock Tokens never use this unrestricted vault; they remain in the separate identity, jurisdiction, sanctions, and wallet-control claim system.
- HOODED does not depend on voluntary marketplace royalties as a guaranteed revenue source.
- Automatic wallet spraying is avoided. Permissionless pull delivery prevents mass-transfer gas failures and lets any account sponsor settlement without redirecting value.
- Fee-dependent rewards are described as variable and possibly zero. No yield, return, liquidity, or listing is promised.

## Implemented original primitive

`packages/contracts/src/HeroRoundRewardVault.sol` provides:

- one immutable reward token and one immutable sequential Genesis Hero collection;
- permissionless round funding and permissionless claim triggering;
- equal per-Hero accounting with late-mint exclusion;
- token-ID-bound stamps so accrued value follows ownership;
- rounding carry, funded/delivered/liability counters, and public checkpoints;
- no owner, withdrawal, rescue, fee change, participant-weight change, or arbitrary-call path.

The contract is unaudited and not authorized for deployment. It requires invariant testing, independent review, UI disclosure, and an approved funding manifest before mainnet consideration.
