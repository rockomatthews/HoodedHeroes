# Launch Bay — Code Bazaar project FOUNDRY-01

Launch Bay is HOODED's first community-built open-source project. It is a fixed-price, timed, pro-rata fair-launch system for Robinhood Chain, Base, and—after an independent implementation and audit—Solana. The same public pipeline will be used to rehearse the fixed one-billion-supply `$HOODED` launch that gates society previews and Genesis Hero purchases.

This folder is the project's contribution front door. Production code remains in the monorepo packages so contracts, APIs, UI, simulations, and tests share one version history:

- `packages/contracts`: fixed-supply token, EVM launch factory, fair-launch escrow, immutable vesting, `$HOODED`, and the 3,000-supply Genesis contract.
- `packages/shared/src/launch-manifest.ts`: canonical `LaunchManifestV1`, policy gates, metadata builders, and `$HOODED` genesis preset.
- `apps/web/app/api/launches`: public reads plus gated validation, simulation, proposal, and fail-closed transaction preparation.
- `apps/web/app/components/launch-bay-workbench.tsx`: creator and reviewer interface.
- `docs/vault/Launch Bay`: linked architecture, security, decisions, and release evidence.

## Current milestone

`v1.4.1-h6-remediation` retains the auditor-confirmed Critical and High remediations, the v1.3 M-1/M-2/L-1 follow-up, closes H-5/M-5, partitions finalization from terminal retirement for H-6, and includes canonical pool registry readback for Robinhood Chain. It is not approved or deployed: the remediation, v1.4 interface, registry, and still-unimplemented Uniswap v4 adapter require independent review. STARFOX is a future token intended to use Launch Bay, not the name of this integration. Base and Solana remain unavailable.

The two rehearsal identities are permanently reserved as `HOODED LAB 01 / HLAB1` and `HOODED LAB 02 / HLAB2`. Both are experimental, have no promised value, and create no public liquidity pool.

## Contribution contract

1. Choose an issue or Code Bazaar bounty.
2. Link a current Genesis Hero wallet to GitHub and work only from the approved private-repository commit in the isolated sandbox.
3. Add or strengthen tests before changing protocol behavior.
4. Attach the diff, SBOM, build hash, test transcript, and threat-model impact.
5. Sign the commit and include DCO sign-off.
6. Open a pull request. Never push directly to a protected branch.
7. Contract, deployment, fee, gate, or metadata-identity changes require peer review and security-council approval.

See [CONTRIBUTING.md](./CONTRIBUTING.md), [SECURITY.md](./SECURITY.md), and the [Launch Bay vault index](../../docs/vault/Launch%20Bay/00%20-%20Launch%20Bay%20Index.md).
