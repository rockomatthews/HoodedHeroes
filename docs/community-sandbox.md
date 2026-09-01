# HOODED community sandbox

The Code Bazaar control plane is implemented with `@vercel/sandbox`, but it is fail-closed by default. It cannot create a microVM until all of the following are true:

1. `ENABLE_VERCEL_SANDBOX=true` is set server-side.
2. Vercel OIDC or explicitly authorized local Vercel credentials are available.
3. PostgreSQL contains a currently verified Genesis Hero member.
4. The request has a signed, unexpired society session, same-origin headers, and an idempotency key.
5. `GITHUB_REPOSITORY` identifies the one GitHub App-approved repository and `SANDBOX_BASE_COMMIT` is a reviewed full commit hash. The browser cannot choose either value.
6. A reviewed `WEB_EVM_SANDBOX_SNAPSHOT_ID` or `SOLANA_SANDBOX_SNAPSHOT_ID` is configured. Production never falls back to cloning arbitrary source.

## Runtime images

- `web-evm-v1`: Node 24, pnpm, Foundry, Slither, Semgrep, and build tooling.
- `solana-v1`: Node 24, pnpm, pinned Rust/Solana/Anchor tooling; reviewed project dependencies provide Metaplex libraries.

Production uses audited snapshot IDs in `WEB_EVM_SANDBOX_SNAPSHOT_ID` and `SOLANA_SANDBOX_SNAPSHOT_ID`. Snapshot creation requires an explicit build flag and pinned tool versions. Review the resulting tool manifest and snapshot ID in a dedicated infrastructure change. Never install floating `latest` binaries in a production snapshot.

The control plane rejects session creation when a reviewed snapshot is absent. Sessions start with deny-all network access. The dependency-install preset temporarily allows only the npm registry and restores deny-all in a `finally` block. Only preset argument arrays are executed; arbitrary shell text is not accepted by the API.

## Persistence and pull requests

PostgreSQL stores sessions, run evidence, proposal state, GitHub links, official access grants, and review attestations. Git commits remain the source of truth. Vercel snapshots are disposable caches. The GitHub App connects a verified Hero wallet to a GitHub account, grants the `Verified Heroes` team official private-repository access, streams gated source archives, and opens evidence-backed pull requests. An hourly reconciliation revokes official access after Hero ownership is lost. AGPL recipients may still redistribute source they already downloaded.

## Operator checklist

- Apply `docs/schema.sql` to a non-production database and test row-level ownership checks.
- Create the Vercel snapshots and record their tool manifests and SHA-256 build hashes.
- Set the mainnet read-only RPC, `$HOODED`, and Genesis NFT addresses only after their verified deployment receipts are published.
- Set `SANDBOX_BASE_COMMIT` to the full SHA of the reviewed protected-branch revision.
- Use a 32+ character random `SOCIETY_SESSION_SECRET`.
- Verify sandbox egress denial, resource limits, cross-user denial, expiration, and idempotent retries.
- Run a closed Genesis Hero exercise before enabling the feature flag in production.
