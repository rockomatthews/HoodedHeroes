import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { HERO_TIERS, HLAB1_MANIFEST, HLAB2_MANIFEST, HOODED_GENESIS_MANIFEST, HOODED_PREVIEW_THRESHOLD, buildMetaplexMetadata, canonicalJson, evaluateSocietyAccess, metadataRevisionPayload, simulateProRataLaunch, validateHeroGenesisManifest, validateLaunchManifest, validateMediaPackage, type HeroGenesisManifestV1, type LaunchMediaPackage } from "@hooded/shared";

function sealMetadata(manifest: typeof HOODED_GENESIS_MANIFEST) {
  manifest.metadata.revision.contentHash = createHash("sha256").update(canonicalJson(metadataRevisionPayload(manifest.metadata))).digest("hex");
  manifest.metadata.revision.signature = `0x${"11".repeat(65)}`;
}

describe("LaunchManifestV1", () => {
  it("accepts a completed sealed HOODED mainnet canary manifest", () => {
    const manifest = structuredClone(HOODED_GENESIS_MANIFEST);
    manifest.metadata.creatorWallet = "0x1111111111111111111111111111111111111111";
    manifest.metadata.sourceCommit = "a".repeat(40);
    manifest.metadata.buildHash = "b".repeat(64);
    manifest.metadata.immutableCoreHash = "c".repeat(64);
    manifest.fees.rewardsRecipient = "0x2222222222222222222222222222222222222222";
    manifest.metadata.publication.image = "ipfs://bafybeigenuinehoodedicon";
    sealMetadata(manifest);
    const result = validateLaunchManifest(manifest);
    expect(result.ready).toBe(true);
    expect(result.passed).toBe(14);
  });

  it("keeps placeholder metadata and build evidence out of canary-ready state", () => {
    const manifest = structuredClone(HOODED_GENESIS_MANIFEST);
    manifest.metadata.creatorWallet = "0x1111111111111111111111111111111111111111";
    const result = validateLaunchManifest(manifest);
    expect(result.ready).toBe(false);
    expect(result.checks.filter((check) => !check.passed).map((check) => check.id)).toEqual(expect.arrayContaining(["build", "fees"]));
  });

  it("canonicalizes metadata revisions independent of object insertion order", () => {
    expect(canonicalJson({ z: 1, a: { y: 2, b: 3 } })).toBe('{"a":{"b":3,"y":2},"z":1}');
    const manifest = structuredClone(HOODED_GENESIS_MANIFEST);
    sealMetadata(manifest);
    const firstHash = manifest.metadata.revision.contentHash;
    manifest.metadata.publication.summary += " Updated.";
    sealMetadata(manifest);
    expect(manifest.metadata.revision.contentHash).not.toBe(firstHash);
  });

  it("blocks fee, authority, and allocation escapes", () => {
    const manifest = structuredClone(HOODED_GENESIS_MANIFEST);
    manifest.metadata.creatorWallet = "0x1111111111111111111111111111111111111111";
    manifest.fees.saleFeeBps = 101;
    manifest.metadata.authorities.futureMint = true as false;
    manifest.sale.creatorAllocationBps = 1_500;
    const result = validateLaunchManifest(manifest);
    expect(result.ready).toBe(false);
    expect(result.checks.filter((check) => !check.passed).map((check) => check.id)).toEqual(expect.arrayContaining(["supply", "allocation", "fees"]));
  });

  it("blocks price mismatches and removal of the sealed canary controls", () => {
    const manifest = structuredClone(HOODED_GENESIS_MANIFEST);
    manifest.metadata.creatorWallet = "0x1111111111111111111111111111111111111111";
    manifest.sale.pricePerToken = "2";
    manifest.canary.sealedAtCreation = false as true;
    const result = validateLaunchManifest(manifest);
    expect(result.ready).toBe(false);
    expect(result.checks.filter((check) => !check.passed).map((check) => check.id)).toEqual(expect.arrayContaining(["raise", "canary"]));
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

  it("locks the selected HOODED raise, cap, and price mathematics", () => {
    expect(HOODED_GENESIS_MANIFEST.sale).toMatchObject({
      pricePerToken: "25000000000",
      minimumRaise: "250000000000000000",
      maximumRaise: "10000000000000000000",
      maximumContributionPerWallet: "100000000000000000",
      liquidityQuoteShareBps: 3750,
    });
    expect(BigInt(HOODED_GENESIS_MANIFEST.metadata.exactSupply) * 4_000n / 10_000n * BigInt(HOODED_GENESIS_MANIFEST.sale.pricePerToken) / 10n ** 18n).toBe(10n * 10n ** 18n);
  });

  it("keeps both lab tokens explicit, owner-only, and without a public pool", () => {
    for (const manifest of [HLAB1_MANIFEST, HLAB2_MANIFEST]) {
      expect(manifest.launchClass).toBe("lab");
      expect(manifest.environment).toBe("mainnet-canary");
      expect(manifest.liquidity.venue).toBe("none");
      expect(manifest.metadata.publication.riskDisclosure).toContain("NO VALUE");
    }
  });

  it("validates the immutable ten-Recruit founder grant inside 3,000", () => {
    const manifest: HeroGenesisManifestV1 = {
      schemaVersion: "1.0.0", collection: "HOODED Genesis Heroes", symbol: "HEROES", exactSupply: 3_000,
      founderRecipient: "0x1111111111111111111111111111111111111111",
      founderGrant: { count: 10, tier: "Recruit", firstTokenId: 1, lastTokenId: 10, price: 0, transferable: true, consumesPrimaryMint: true },
      publicMintStartsAt: "2026-12-01T00:00:00.000Z", metadataBaseUri: "ipfs://bafyheroes/", metadataRoot: `0x${"a".repeat(64)}`,
      governance: "one-wallet-one-vote", receiptSplitBps: { burn: 4_000, rewards: 4_000, dao: 2_000 }, tiers: HERO_TIERS,
    };
    expect(validateHeroGenesisManifest(manifest)).toEqual({ exactSupply: true, founderGrant: true, publicSupply: true, receiptSplit: true, metadata: true });
  });

  it("requires the complete launch media package", () => {
    const media: LaunchMediaPackage = {
      schema: "hooded-media-package/v1", brand: "HOODED", alt: "Original HOODED comic-book society token emblem", rights: "Original artwork",
      assets: [
        ["icon-2048.png", 2048, 2048], ["icon-1000.png", 1000, 1000], ["icon-512.png", 512, 512], ["header-1500x500.png", 1500, 500], ["og-1200x630.png", 1200, 630],
      ].map(([file, width, height]) => ({ file: String(file), mime: "image/png" as const, width: Number(width), height: Number(height), sha256: "a".repeat(64) })),
      immutableCopies: { ipfs: null, arweave: null }, publicationStatus: "generated-not-submitted",
    };
    expect(validateMediaPackage(media)).toEqual({ valid: true, failures: [] });
  });
});

describe("society gate", () => {
  it("requires 25,000 HOODED for preview and a Genesis NFT for builder access", () => {
    expect(evaluateSocietyAccess({ hoodedBalance: HOODED_PREVIEW_THRESHOLD - 1n, genesisHeroBalance: 0n })).toBe("vestibule");
    expect(evaluateSocietyAccess({ hoodedBalance: HOODED_PREVIEW_THRESHOLD, genesisHeroBalance: 0n })).toBe("preview");
    expect(evaluateSocietyAccess({ hoodedBalance: 0n, genesisHeroBalance: 1n })).toBe("hero");
  });
});
