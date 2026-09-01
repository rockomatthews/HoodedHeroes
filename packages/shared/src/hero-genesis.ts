import { FOUNDER_HERO_GRANT, HERO_TIERS } from "./hero-tiers";

export type HeroGenesisManifestV1 = {
  schemaVersion: "1.0.0";
  collection: "HOODED Genesis Heroes";
  symbol: "HEROES";
  exactSupply: 3_000;
  founderRecipient: `0x${string}`;
  founderGrant: {
    count: 10;
    tier: "Recruit";
    firstTokenId: 1;
    lastTokenId: 10;
    price: 0;
    transferable: true;
    consumesPrimaryMint: true;
  };
  publicMintStartsAt: string;
  metadataBaseUri: string;
  metadataRoot: `0x${string}`;
  governance: "one-wallet-one-vote";
  receiptSplitBps: { burn: 4_000; rewards: 4_000; dao: 2_000 };
  tiers: typeof HERO_TIERS;
};

export function validateHeroGenesisManifest(manifest: HeroGenesisManifestV1) {
  const tierTotal = manifest.tiers.reduce((total, tier) => total + tier.supply, 0);
  const publicTotal = manifest.tiers.reduce((total, tier) => total + tier.publicSupply, 0);
  const founderTotal = manifest.tiers.reduce((total, tier) => total + tier.founderSupply, 0);
  return {
    exactSupply: manifest.exactSupply === 3_000 && tierTotal === 3_000,
    founderGrant: manifest.founderGrant.count === FOUNDER_HERO_GRANT && founderTotal === FOUNDER_HERO_GRANT,
    publicSupply: publicTotal === 2_990,
    receiptSplit: Object.values(manifest.receiptSplitBps).reduce((sum, value) => sum + value, 0) === 10_000,
    metadata: /^ipfs:\/\//.test(manifest.metadataBaseUri) && /^0x[a-fA-F0-9]{64}$/.test(manifest.metadataRoot),
  };
}
