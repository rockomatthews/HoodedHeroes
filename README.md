# HoodedHeroes

HoodedHeroes is a comic-book-styled game, private builder society, isolated community sandbox, and tri-chain fair-launch system. The entry experience remains a fixed, no-scroll comic-cover composition based directly on the accepted concept art.

## Local development

```bash
pnpm install
pnpm dev
```

The application opens in preview mode. The wallet control is deliberately simulated and labeled by the interface; it performs no transaction. No live token, NFT, Stock Token, or wallet contract is implied until verified testnet addresses are configured.

## Workspace

- `apps/web`: Next.js entry portal, Command Center, Code Bazaar control plane, Launch Bay, public token pages, and guarded APIs.
- `apps/score-service`: signed deterministic-score verification primitives.
- `packages/contracts`: fixed-supply HERO/Genesis foundations plus the original pro-rata EVM fair-launch testnet candidate.
- `packages/game-engine`: deterministic Power Grid seed, path validation, and score calculation.
- `packages/shared` and `packages/ui`: product rules and reusable comic components.
- `art/concepts`: three approved concept directions and their prompt record.
- `art/characters`: preserved v1 designs and v2 website cutouts for Inferno, Volt, Pulse, Circuit, and Phantom.
- `docs`: architecture, economy, persistence schema, security, and Vercel notes.
- `docs/vault`: an Obsidian-compatible, repository-native project knowledge graph.
- `projects/launch-bay`: the first Code Bazaar community project, including its charter, contribution contract, backlog, and release gates.

## Community Sandbox and Launch Bay

Copy `.env.example` to `.env.local` and configure only testnet infrastructure. The sandbox and transaction preparation are fail-closed; they remain unavailable until the database, verified HoodedHero gate, Vercel snapshots, and audited deployment addresses are present. See `docs/community-sandbox.md` and `docs/launch-bay-v1.md`.

Original source code is offered under AGPL-3.0-or-later. Competitor implementations with incompatible or source-restricted licenses must not be copied into this repository.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm --filter @hoodedheroes/contracts test
```

## Safety gates

Mainnet token issuance, Stock Token funding or transfers, public sales, and launchpad activation require independent audits, legal review, and explicit deployment approval. The contracts in this repository are implementation foundations, not audited production releases.
