# HOODED

HOODED is a comic-book-styled game, private builder society, isolated community sandbox, and tri-chain fair-launch system. The entry experience remains a fixed, no-scroll comic-cover composition based directly on the accepted concept art.

## Local development

```bash
pnpm install
pnpm dev
```

The application opens in preview mode. The wallet control is deliberately simulated and labeled by the interface; it performs no transaction. No live token, NFT, Stock Token, or wallet contract is implied until verified mainnet addresses and receipts are published.

## Workspace

- `apps/web`: Next.js entry portal, Command Center, Code Bazaar control plane, Launch Bay, public token pages, and guarded APIs.
- `apps/score-service`: signed deterministic-score verification primitives.
- `packages/contracts`: versioned lab and approval-gated production launch factories, fixed-supply token, pro-rata sale, immutable fee/reward/vesting components, liquidity coordinator, and the 3,000-cap Genesis collection.
- `packages/game-engine`: deterministic Power Grid seed, path validation, and score calculation.
- `packages/shared` and `packages/ui`: product rules and reusable comic components.
- `art/concepts`: three approved concept directions and their prompt record.
- `art/characters`: preserved v1 designs and v2 website cutouts for Inferno, Volt, Pulse, Circuit, and Phantom.
- `docs`: architecture, economy, persistence schema, security, and Vercel notes.
- `docs/vault`: an Obsidian-compatible, repository-native project knowledge graph.
- `projects/launch-bay`: the first Code Bazaar community project, including its charter, contribution contract, backlog, and release gates.

## Community Sandbox and Launch Bay

Copy `.env.example` to the ignored `.env` file. The sandbox, owner-only lab path, and production preparation path are fail-closed. Preparation remains unavailable until the database, reviewed Vercel snapshots, mainnet RPC, audited contracts, Safe approval signer, canonical Uniswap managers, and exact runtime bytecode hashes are configured. Treasury and grant allocations are read back against the configured timelock and 24-month vesting vault. Even then, the API only returns a decoded unsigned transaction after a successful mainnet simulation. See `docs/community-sandbox.md`, `docs/launch-bay-v1.md`, and `docs/production-release-runbook.md`.

Original source code is offered under AGPL-3.0-or-later. Competitor implementations with incompatible or source-restricted licenses must not be copied into this repository.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm --filter @hooded/contracts test
```

## Safety gates

Mainnet token issuance, Stock Token funding or transfers, public sales, and launchpad activation require independent audits, legal review, and explicit transaction-level approval. The contracts in this repository are implementation foundations, not audited production releases. Nothing in the repository broadcasts a transaction.
