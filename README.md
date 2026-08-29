# HoodedHeroes

HoodedHeroes is a comic-book-styled game and private builder society designed for Robinhood Chain. The entry experience is a fixed, no-scroll comic-cover composition based directly on the accepted first concept, with five separately illustrated original HoodedHeroes. This repository also contains the deterministic Power Grid engine, score-service foundations, and testnet-oriented contract scaffolding.

## Local development

```bash
pnpm install
pnpm dev
```

The application opens in preview mode. The wallet control is deliberately simulated and labeled by the interface; it performs no transaction. No live token, NFT, Stock Token, or wallet contract is implied until verified testnet addresses are configured.

## Workspace

- `apps/web`: Next.js no-scroll entry portal and interactive founding-hero dossiers.
- `apps/score-service`: signed deterministic-score verification primitives.
- `packages/contracts`: fixed-supply token, 3,000-member genesis NFT, and immutable reward-vault foundations.
- `packages/game-engine`: deterministic Power Grid seed, path validation, and score calculation.
- `packages/shared` and `packages/ui`: product rules and reusable comic components.
- `art/concepts`: three approved concept directions and their prompt record.
- `art/characters`: preserved v1 designs and v2 website cutouts for Inferno, Volt, Pulse, Circuit, and Phantom.
- `docs`: architecture, economy, persistence schema, security, and Vercel notes.

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
