# Provider readiness for Hooded Launch Bay

This document defines the Hooded side of provider onboarding. It does not assert that Mancer or LI.FI supports Robinhood Chain, the eventual Uniswap v4 venue, or any HOODED launch. Both providers remain `unverified` until an attributable confirmation is recorded in `launch_provider_readiness`.

## Stable public surfaces

- Token-by-address registry: `GET https://hooded.world/api/v1/launches/4663/{tokenAddress}`
- Robinhood Chain token list: `GET https://hooded.world/api/v1/token-lists/4663`
- Canonical launcher identity: `Hooded`
- Canonical launcher URL: `https://hooded.world`

Unknown, invalid, and non-Robinhood token addresses return `404`. A known but incomplete launch returns `200` with `status: "incomplete"`, `tradable: false`, and an explicit `incompleteReasons` list. Only verified, public-eligible launches with creation, activation, and finalization transactions plus a verified permanent canonical pool enter the token list.

## Prelaunch onboarding payload

Prepare this evidence package for each provider without sending it until separately approved:

```json
{
  "schema": "hooded.provider-prelaunch/v1",
  "launcher": "Hooded",
  "chainId": 4663,
  "token": { "address": null, "name": "", "symbol": "", "decimals": 18, "exactSupply": "" },
  "manifest": { "hash": "", "sourceCommit": "", "buildHash": "", "factoryVersion": "" },
  "factory": { "address": "", "runtimeCodeHash": "" },
  "plannedVenue": {
    "identifier": "uniswap-v4",
    "poolManager": "",
    "positionManager": "",
    "wrappedNative": "",
    "fee": null,
    "tickSpacing": null,
    "hook": null
  },
  "liquidity": { "price": "", "tokenAmount": "", "quoteAmount": "", "permanentlyLocked": true },
  "registryUrlTemplate": "https://hooded.world/api/v1/launches/4663/{tokenAddress}",
  "tokenListUrl": "https://hooded.world/api/v1/token-lists/4663",
  "audit": { "adapterReviewedCommit": null, "reportUrl": null },
  "status": "prelaunch-not-live"
}
```

Prelaunch checklist:

- Confirm the provider recognizes Robinhood Chain ID `4663` and the exact wrapped-native token.
- Confirm support for the exact Uniswap v4 PoolManager, PositionManager, fee, tick spacing, and hook configuration—not generic “Uniswap support.”
- Confirm the provider indexes the token by contract address and consumes the Hooded canonical registry without symbol-based matching.
- Confirm incomplete registry records are rejected and never presented as tradable.
- Confirm no provider API key, quote, router, or approval address is embedded in a token, sale, coordinator, or adapter contract.
- Keep `mancer` and `lifi` status `unverified` until written confirmation and a reproducible integration test exist.

## Finalization payload

After an explicitly approved and independently audited finalization transaction, derive this payload from the canonical registry response rather than hand-entering it:

```json
{
  "schema": "hooded.provider-finalization/v1",
  "chainId": 4663,
  "launcher": "Hooded",
  "registryUrl": "https://hooded.world/api/v1/launches/4663/{tokenAddress}",
  "tokenListUrl": "https://hooded.world/api/v1/token-lists/4663",
  "token": {},
  "manifest": {},
  "factory": {},
  "canonicalPool": {
    "token": "",
    "quoteToken": "",
    "venueId": "",
    "poolId": "",
    "fee": 0,
    "tickSpacing": 0,
    "hook": "",
    "positionId": "",
    "positionLock": "",
    "permanentlyLocked": true
  },
  "transactionHashes": { "creation": "", "activation": "", "finalization": "" },
  "providerReadiness": { "mancer": { "status": "unverified" }, "lifi": { "status": "unverified" } }
}
```

Finalization checklist:

- Compare every descriptor field with `RobinhoodLiquidityCoordinator.canonicalPool()` and the `CanonicalPoolActivated` event.
- Verify the position ID is held by the immutable permanent lock and the finalization transaction matches the registry.
- Test the token-by-address lookup from Hooded to each provider and from each provider back to the exact Hooded registry URL.
- For Mancer, obtain exact confirmation that its router/quoting path supports this Robinhood Chain v4 pool configuration and does not assume a v2/v3 pool.
- For LI.FI, obtain exact route support confirmation, validate destination-gas estimation and delivery on chain ID `4663`, and confirm failure behavior when destination gas is unavailable.
- Record evidence URLs and confirmation timestamps in `launch_provider_readiness`; never infer `confirmed` from a successful generic chain query.

## Contract boundary

Contracts expose canonical pool identity and fail closed on malformed adapter output. They do not call Mancer or LI.FI. The adapter’s callback authority and price-protection declarations are release gates, not proof of correct implementation; the source and bytecode still require independent review and mainnet-fork canaries.
