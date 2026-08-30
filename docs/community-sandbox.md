# HoodedHeroes community sandbox

The Code Bazaar control plane is implemented with `@vercel/sandbox`, but it is fail-closed by default. It cannot create a microVM until all of the following are true:

1. `ENABLE_VERCEL_SANDBOX=true` is set server-side.
2. Vercel OIDC or explicitly authorized local Vercel credentials are available.
3. PostgreSQL contains a currently verified HoodedHero member.
4. The request has a signed, unexpired society session, same-origin headers, and an idempotency key.
5. The repository is exactly `rockomatthews/HoodedHeroes` and `SANDBOX_BASE_COMMIT` is a reviewed full commit hash.

## Runtime images

- `web-evm-v1`: Node 24, pnpm, Foundry, Slither, Semgrep, and build tooling.
- `solana-v1`: Node 24, pnpm, pinned Rust/Solana/Anchor/Metaplex tooling.

Production uses audited snapshot IDs in `WEB_EVM_SANDBOX_SNAPSHOT_ID` and `SOLANA_SANDBOX_SNAPSHOT_ID`. Build snapshots from pinned, checksummed tool releases in a dedicated infrastructure change. Never install floating `latest` binaries in a production snapshot.

When no snapshot exists, the SDK may clone the approved public repository under a narrow GitHub/npm allowlist. Before any community command runs, the control plane changes the microVM to `deny-all` network access. The dependency-install preset temporarily allows only the npm registry and restores `deny-all` in a `finally` block. Only preset argument arrays are executed; arbitrary shell text is not accepted by the API.

## Persistence and pull requests

PostgreSQL stores sessions, run evidence, proposal state, and review attestations. Git commits remain the source of truth. Vercel snapshots are disposable caches. A future GitHub App installation receives contents/pull-request access only; protected branches require reviews, passing checks, signed commits, and DCO sign-off.

## Operator checklist

- Apply `docs/schema.sql` to a non-production database and test row-level ownership checks.
- Create the Vercel snapshots and record their tool manifests and SHA-256 build hashes.
- Set the RH testnet RPC, `$HERO`, and Genesis NFT addresses.
- Set `SANDBOX_BASE_COMMIT` to the full SHA of the reviewed protected-branch revision.
- Use a 32+ character random `SOCIETY_SESSION_SECRET`.
- Verify sandbox egress denial, resource limits, cross-user denial, expiration, and idempotent retries.
- Run a closed HoodedHero exercise before enabling the feature flag in production.
