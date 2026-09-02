# Command Center release matrix

Every colored district and the central signal has a real purpose. A visible control must either execute its named workflow or display the exact missing gate; decorative success states are forbidden.

| Area | Implemented workflow | Authoritative state | Release blocker |
|---|---|---|---|
| Mission Deck | Playable deterministic Power Grid practice trace | `@hooded/game-engine` | Reward credit remains disabled until Hero-ID ownership and score nonce consumption are atomic |
| Code Bazaar | Approved repository source, isolated edits/tests, evidence, proposal, GitHub PR export | Git commits, PostgreSQL, Vercel Sandbox | GitHub App, production OIDC, reviewed snapshots, adversarial tests |
| Assembly | Public proposal registry and Hero-gated evidence-hash peer attestations | `launches`, `launch_reviews` | Council/legal/audit decisions remain separate roles; no UI vote deploys anything |
| Launch Bay | Manifest editing, validation, metadata formats, pro-rata simulation, Hero-gated registry submission | Versioned manifest plus PostgreSQL/on-chain readback | v1.7 audit, exact factory/adapter binding, canaries, explicit transaction approvals |
| Stock Token Vault | Current four-part eligibility readback and six-asset status | `stock_token_eligibility` | No claim or “funded” label until regulated assets, jurisdiction controls, and contract vaults are verified |
| Hero Workshop | Hero-gated ability/gear draft persistence | `hero_loadout_drafts` | No Salary Credit spending or on-chain progression mutation until ownership-aware progression is audited |
| Community Signal | Creed, gated channel reads/posts, activity | `community_messages` | Database, moderation, rate limits, and live Hero session required |

Base and Solana remain unavailable. Practice scores, draft loadouts, peer attestations, and review packages never broadcast transactions. The desktop Command Center remains fixed/no-scroll; mobile rooms deliberately scroll inside the zoomed district map.

## Immutable creation checklist

Before any production factory or token launch is created, freeze and cross-check as one release set:

- production factory, all four component deployers, approval Safe, and their runtime hashes;
- CREATE2 adapter deployer, salt, init-code hash, adapter address, runtime hash, exact factory binding, and exact liquidity-deployer binding;
- PoolManager, PositionManager, Permit2, WETH, fee, tick spacing, hook flags, full-range ticks, and Robinhood Chain ID;
- token supply, decimals, allocations, price, contribution limits, timing, claim deadline, liquidity share, fee recipients, vesting start/duration, and burn/refund rules;
- sale proceeds, rewards, treasury, council, eligibility signer, founder, Genesis start, metadata root, and every contract-address-first publication record;
- incident/refund procedure, finalization window, permissionless settlement/refund paths, permanent position receiver, and terminal retirement behavior.

The production transaction preparer must read back that the adapter's `authorizedFactory` equals the configured factory and its `coordinatorDeployer` equals the factory's live `liquidityDeployer`. A mismatch is a hard stop, because these values cannot be repaired after creation.
