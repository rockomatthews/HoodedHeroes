import { describe, expect, it } from "vitest";
import { HOODED_GENESIS_MANIFEST } from "@hooded/shared";
import {
  buildRobinhoodRegistryRecord,
  buildRobinhoodTokenListFromRegistrySources,
  robinhoodRegistryHttpResult,
  type RegistryEventRow,
  type RegistryLaunchRow,
  type RegistryPositionRow,
} from "../public-launch-registry-core";

const TOKEN = "0x1111111111111111111111111111111111111111";
const SALE = "0x2222222222222222222222222222222222222222";
const FACTORY = "0x3333333333333333333333333333333333333333";
const COORDINATOR = "0x4444444444444444444444444444444444444444";
const LOCK = "0x5555555555555555555555555555555555555555";
const MANAGER = "0x6666666666666666666666666666666666666666";
const QUOTE = "0x7777777777777777777777777777777777777777";
const ZERO = "0x0000000000000000000000000000000000000000";
const tx = (value: string) => `0x${value.repeat(64)}`;

function launch(overrides: Partial<RegistryLaunchRow> = {}): RegistryLaunchRow {
  const manifest = structuredClone(HOODED_GENESIS_MANIFEST);
  manifest.lifecycle = "public-eligible";
  manifest.metadata.tokenAddress = TOKEN;
  manifest.metadata.creatorWallet = "0x8888888888888888888888888888888888888888";
  return {
    project_id: "hooded-genesis",
    chain: "robinhood",
    lifecycle: "public-eligible",
    token_address: TOKEN,
    sale_address: SALE,
    factory_address: FACTORY,
    manifest_hash: tx("9"),
    manifest,
    ...overrides,
  };
}

function position(overrides: Partial<RegistryPositionRow> = {}): RegistryPositionRow {
  return {
    coordinator_address: COORDINATOR,
    lock_address: LOCK,
    position_manager: MANAGER,
    position_id: "42",
    token_address: TOKEN,
    quote_token_address: QUOTE,
    venue_identifier: tx("1"),
    pool_id: tx("2"),
    fee: 3_000,
    tick_spacing: 60,
    hook_address: ZERO,
    finalization_transaction_hash: tx("c"),
    permanently_locked: true,
    verified_at: "2026-09-01T12:00:00.000Z",
    ...overrides,
  };
}

const events: RegistryEventRow[] = [
  { event_name: "LaunchCreated", transaction_hash: tx("a") },
  { event_name: "Activated", transaction_hash: tx("b") },
  { event_name: "CanonicalPoolActivated", transaction_hash: tx("c") },
];

describe("public Robinhood launch registry", () => {
  it("returns a complete canonical pool and defaults providers to unverified", () => {
    const record = buildRobinhoodRegistryRecord({ launch: launch(), position: position(), events });
    expect(record?.status).toBe("tradable");
    expect(record?.tradable).toBe(true);
    expect(record?.canonicalPool).toMatchObject({
      token: TOKEN,
      quoteToken: QUOTE,
      venueId: tx("1"),
      poolId: tx("2"),
      positionId: "42",
      positionLock: LOCK,
      permanentlyLocked: true,
    });
    expect(record?.transactionHashes).toEqual({ creation: tx("a"), activation: tx("b"), finalization: tx("c") });
    expect(record?.providerReadiness).toEqual({
      mancer: { status: "unverified", evidenceUrl: null, confirmedAt: null },
      lifi: { status: "unverified", evidenceUrl: null, confirmedAt: null },
    });
    expect(robinhoodRegistryHttpResult(record).status).toBe(200);
  });

  it("rejects invalid or non-Robinhood registry records", () => {
    expect(buildRobinhoodRegistryRecord({ launch: launch({ chain: "base" }), position: position(), events })).toBeNull();
    expect(buildRobinhoodRegistryRecord({ launch: launch({ token_address: "not-an-address" }), position: position(), events })).toBeNull();
    expect(robinhoodRegistryHttpResult(null)).toEqual({ status: 404, body: { error: "Robinhood Chain launch not found" } });
  });

  it("returns incomplete launches explicitly and never labels them tradable", () => {
    const record = buildRobinhoodRegistryRecord({ launch: launch({ lifecycle: "mainnet-verified" }), position: null, events: events.slice(0, 2) });
    expect(record?.status).toBe("incomplete");
    expect(record?.tradable).toBe(false);
    expect(record?.canonicalPool).toBeNull();
    expect(record?.incompleteReasons).toContain("verified-canonical-pool");
    expect(record?.incompleteReasons).toContain("public-eligible-lifecycle");
    expect(robinhoodRegistryHttpResult(record)).toMatchObject({ status: 200, body: { tradable: false, status: "incomplete" } });
  });

  it("builds the token list only from complete verified public-eligible records", () => {
    const incomplete = { launch: launch({ project_id: "incomplete", lifecycle: "mainnet-verified" }), position: null, events };
    const wrongChain = { launch: launch({ project_id: "base-token", chain: "base" }), position: position(), events };
    const list = buildRobinhoodTokenListFromRegistrySources(
      [{ launch: launch(), position: position(), events }, incomplete, wrongChain],
      "2026-09-01T13:00:00.000Z",
    );
    expect(list.tokens).toHaveLength(1);
    expect(list.tokens[0]).toMatchObject({
      chainId: 4663,
      address: TOKEN,
      extensions: { launcher: "Hooded", launcherUrl: "https://hooded.world" },
    });
  });
});
