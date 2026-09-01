# HOODED production release runbook

This runbook is intentionally noncustodial. Repository scripts calculate bytecode, addresses, hashes, gas, and unsigned transactions. They do not accept private keys or broadcast.

## Gate 0 — freeze people and artifacts

1. Confirm the founder recipient and three 2-of-3 Safe signers out of band.
2. Deploy/configure the Safe and seven-day DAO timelock; publish owners, threshold, modules, and delay.
3. Freeze `LaunchManifestV1.1`, media hashes, Git commit, compiler settings, community-grants vault, reward vault, eligibility signer, and legal/risk disclosures.
4. Generate the 3,000-Hero collection with `node scripts/generate-hero-collection.mjs`. Replace image-CID placeholders only after the image directory is pinned; recalculate the collection root after the final metadata directory is pinned.
5. Record the final Hero metadata root and base URI. Do not deploy a mutable placeholder collection.

## Gate 1 — local and fork evidence

Run:

```text
CI=true pnpm lint
CI=true pnpm typecheck
CI=true pnpm test
CI=true pnpm build
CI=true pnpm test:e2e
slither packages/contracts --filter-paths 'lib|test' --exclude-dependencies
semgrep --config auto .
CI=true pnpm audit --audit-level high
pnpm canary:rpc-check
pnpm canary:fork:rh
node scripts/canary-build-evidence.mjs --require-clean
node scripts/production-factory-plan.mjs
node scripts/robinhood-uniswap-readback.mjs
```

The factory plan must report chain ID 4663, matching approval signer, reviewed bytecode hashes, sufficient deployer ETH, and `broadcasts: false`. The Uniswap readback must match the pinned WETH, PoolManager, and PositionManager addresses and reviewed runtime hashes in `docs/robinhood-uniswap-readback.md`. Regenerate both immediately before signing because the predicted address depends on the deployer nonce and protocol bytecode may change.

Record every static-analysis finding and review disposition in `docs/security-static-analysis.md`. A locally missing scanner is a failed release gate, not a silent pass.

## Gate 2 — HLAB1

1. Fill the `HLAB1_MANIFEST` wallet, source/build/core hashes, media URIs, reward vault, timestamps, and revision hash.
2. Advance the stored lifecycle only after metadata, sandbox, peer, security, fork, and simulation evidence exists.
3. Prepare the unsigned lab-factory transaction through `/api/launches/prepare`.
4. Obtain explicit approval, sign in the founder wallet, verify the receipt and Blockscout source, and keep the sale sealed.
5. Validate the public page, token-list payload, Open Graph assets, metadata history, explorer display, and API readback.
6. Cancel before open. After the claim deadline, permissionlessly burn/sweep all supply to the configured irrecoverable sink and record retirement evidence.

## Gate 3 — HLAB2

Repeat HLAB1 evidence, then activate the thirty-minute owner-only sale with a founder-only eligibility permit. Contribute no more than 0.01 ETH, settle, verify fee routing and wallet display, create no DEX pool, and retire the resulting balance. The combined HLAB1/HLAB2 gas and contribution spend must not exceed 0.05 ETH; stop before signing if the latest estimates exceed that cap.

## Gate 4 — production factory and HOODED creation

1. Independent reviewers approve the exact v1.1 source and bytecode.
2. Deploy and verify the approval registry/Safe, reward vault, grants vesting vault, production factory, liquidity adapter, and position manager integration.
3. Configure only verified addresses and runtime hashes in `.env`/Vercel environment variables.
4. Change `ENABLE_PRODUCTION_LAUNCH_PREPARE` only after the infrastructure readback passes.
5. Obtain the Safe EIP-712 approval bound to creator, manifest hash, nonce, and deadline.
6. Use `/api/launches/production/prepare` to simulate and generate the unsigned creation transaction.
7. Obtain explicit transaction approval, sign in the creator wallet, and verify the sealed token/sale/coordinator/lock readback.
8. Publish the complete evidence package for at least seven days before activation.

## Gate 5 — sale, settlement, and liquidity

1. Activate the 72-hour sale in a separate explicitly approved transaction.
2. Eligibility permits may authorize contributions; claims and refunds never require permits.
3. After close, permissionlessly settle every indexed contributor.
4. Below 0.25 ETH: enter refunds and do not call the launch successful.
5. At or above 0.25 ETH: burn unsold sale supply, harvest the 37.5% liquidity quote, mint a price-matched position to the ownerless receiver, burn unused liquidity tokens, and verify the NFT owner/code hashes.
6. Enable the 25,000-HOODED preview gate only after verified token and sale addresses are configured and live readback succeeds.

## Gate 6 — Genesis Heroes

Deploy `HoodedGenesis` only with the final HOODED address, reward vault, DAO timelock, founder recipient, public-mint timestamp, nonzero metadata root, and immutable IPFS base URI. Constructor readback must prove token IDs 1–10 are Recruit NFTs owned by the founder, total minted is 10, Recruit minted is 10, and the founder primary-mint flag is consumed. Public mint begins at least seven days after verified HOODED liquidity.

## External actions

Blockscout verification and free metadata submissions each require approval and recorded readback. Paid boosts, advertisements, influencers, listing payments, Base/Solana activation, Stock Tokens, and any bridge remain outside this runbook.
