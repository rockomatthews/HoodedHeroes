import { describe, expect, it } from "vitest";
import { HOODED_GENESIS_MANIFEST, HOODED_PREVIEW_THRESHOLD, buildMetaplexMetadata, evaluateSocietyAccess, simulateProRataLaunch, validateLaunchManifest } from "@hooded/shared";

describe("LaunchManifestV1", () => {
  it("accepts the bundled HOODED testnet genesis manifest", () => {
    const result = validateLaunchManifest(HOODED_GENESIS_MANIFEST);
    expect(result.ready).toBe(true);
    expect(result.passed).toBe(12);
  });

  it("blocks fee, authority, and allocation escapes", () => {
    const manifest = structuredClone(HOODED_GENESIS_MANIFEST);
    manifest.fees.saleFeeBps = 101;
    manifest.metadata.authorities.futureMint = true as false;
    manifest.sale.creatorAllocationBps = 1_500;
    const result = validateLaunchManifest(manifest);
    expect(result.ready).toBe(false);
    expect(result.checks.filter((check) => !check.passed).map((check) => check.id)).toEqual(expect.arrayContaining(["supply", "allocation", "fees"]));
  });

  it("allocates oversubscription at one pro-rata price", () => {
    const result = simulateProRataLaunch({ saleTokenAllocation: 1_000n, maximumRaise: 100n, contributions: [{ wallet: "A", amount: 80n }, { wallet: "B", amount: 80n }] });
    expect(result.wallets[0]).toMatchObject({ accepted: 50n, refund: 30n, tokenAllocation: 500n });
    expect(result.totalAccepted).toBe(100n);
    expect(result.totalTokensAllocated).toBe(1_000n);
  });

  it("builds Metaplex distribution metadata from the same canonical source", () => {
    const payload = buildMetaplexMetadata(HOODED_GENESIS_MANIFEST.metadata);
    expect(payload.symbol).toBe("HOODED");
    expect(payload.image).toBe(HOODED_GENESIS_MANIFEST.metadata.publication.image);
    expect(payload.attributes).toEqual(expect.arrayContaining([expect.objectContaining({ trait_type: "Build Hash" })]));
  });
});

describe("society gate", () => {
  it("requires 25,000 HOODED for preview and a Genesis NFT for builder access", () => {
    expect(evaluateSocietyAccess({ hoodedBalance: HOODED_PREVIEW_THRESHOLD - 1n, genesisHeroBalance: 0n })).toBe("vestibule");
    expect(evaluateSocietyAccess({ hoodedBalance: HOODED_PREVIEW_THRESHOLD, genesisHeroBalance: 0n })).toBe("preview");
    expect(evaluateSocietyAccess({ hoodedBalance: 0n, genesisHeroBalance: 1n })).toBe("hero");
  });
});
