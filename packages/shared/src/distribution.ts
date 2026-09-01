import type { LaunchMetadataV1 } from "./launch-manifest";

export function buildMetaplexMetadata(metadata: LaunchMetadataV1) {
  return {
    name: metadata.name,
    symbol: metadata.symbol,
    description: metadata.publication.description,
    image: metadata.publication.image,
    external_url: metadata.publication.website,
    properties: { category: "image", files: [{ uri: metadata.publication.image, type: "image/png" }] },
    attributes: [
      { trait_type: "Supply", value: metadata.exactSupply },
      { trait_type: "License", value: metadata.license },
      { trait_type: "Build Hash", value: metadata.buildHash },
      { trait_type: "Immutable Core Hash", value: metadata.immutableCoreHash },
    ],
  };
}

export function buildUniswapTokenList(metadata: LaunchMetadataV1, chainId: number) {
  if (!metadata.tokenAddress) throw new Error("Token address required for an EVM token list");
  return {
    name: "HOODED Verified Launches",
    timestamp: metadata.revision.timestamp,
    version: { major: 1, minor: 0, patch: metadata.revision.version },
    keywords: ["hooded", "fair-launch", metadata.chain],
    tokens: [{
      chainId,
      address: metadata.tokenAddress,
      name: metadata.name,
      symbol: metadata.symbol,
      decimals: metadata.decimals,
      logoURI: metadata.publication.image,
      extensions: { launcher: metadata.launcher, launcherUrl: "https://hooded.world", launchPage: metadata.canonicalLaunchUrl, buildHash: metadata.buildHash, immutableCoreHash: metadata.immutableCoreHash, factoryVersion: metadata.factoryVersion },
    }],
  };
}

export function buildRobinhoodTokenList(metadata: LaunchMetadataV1[], timestamp: string) {
  const tokens = metadata.map((entry) => buildUniswapTokenList(entry, 4663).tokens[0]);
  const patch = metadata.reduce((highest, entry) => Math.max(highest, entry.revision.version), 0);
  return {
    name: "Hooded Verified Robinhood Chain Launches",
    timestamp,
    version: { major: 1, minor: 0, patch },
    keywords: ["hooded", "robinhood-chain", "verified", "fair-launch"],
    tokens,
  };
}

export type MediaPackageAsset = {
  file: string;
  mime: "image/png" | "image/webp";
  width: number;
  height: number;
  sha256: string;
};

export type LaunchMediaPackage = {
  schema: "hooded-media-package/v1";
  brand: string;
  alt: string;
  rights: string;
  assets: MediaPackageAsset[];
  immutableCopies: { ipfs: string | null; arweave: string | null };
  publicationStatus: "generated-not-submitted" | "immutable-published";
};

export function validateMediaPackage(media: LaunchMediaPackage) {
  const expected = new Map([
    ["icon-2048.png", [2048, 2048]], ["icon-1000.png", [1000, 1000]], ["icon-512.png", [512, 512]],
    ["header-1500x500.png", [1500, 500]], ["og-1200x630.png", [1200, 630]],
  ]);
  const failures: string[] = [];
  for (const [file, [width, height]] of expected) {
    const asset = media.assets.find((candidate) => candidate.file === file);
    if (!asset) failures.push(`missing:${file}`);
    else if (asset.width !== width || asset.height !== height || !/^[a-f0-9]{64}$/i.test(asset.sha256)) failures.push(`invalid:${file}`);
  }
  if (media.alt.trim().length < 20) failures.push("invalid:alt");
  if (/robinhood|feather|\$hood\b/i.test(media.brand)) failures.push("brand-conflict");
  if (media.publicationStatus === "immutable-published" && !media.immutableCopies.ipfs && !media.immutableCopies.arweave) failures.push("missing:immutable-copy");
  return { valid: failures.length === 0, failures };
}

export function buildBlockscoutVerificationPackage(metadata: LaunchMetadataV1) {
  if (!metadata.tokenAddress) throw new Error("Token address required for source verification");
  return {
    chainId: metadata.chain === "robinhood" ? 4663 : metadata.chain === "base" ? 8453 : null,
    contractAddress: metadata.tokenAddress,
    compilerVersion: "0.8.27",
    licenseType: "GNU AGPLv3",
    sourceCommit: metadata.sourceCommit,
    buildHash: metadata.buildHash,
    factoryVersion: metadata.factoryVersion,
    manifestCoreHash: metadata.immutableCoreHash,
  };
}

export function buildDexScreenerProfile(metadata: LaunchMetadataV1) {
  if (!metadata.tokenAddress) throw new Error("Token address required for a DEX Screener profile");
  return {
    chainId: metadata.chain,
    tokenAddress: metadata.tokenAddress,
    url: metadata.canonicalLaunchUrl,
    icon: metadata.publication.image,
    header: metadata.publication.header,
    description: metadata.publication.summary,
    links: [
      { type: "website", label: "Website", url: metadata.publication.website },
      metadata.publication.x ? { type: "twitter", label: "X", url: metadata.publication.x } : null,
      metadata.publication.telegram ? { type: "telegram", label: "Telegram", url: metadata.publication.telegram } : null,
      metadata.publication.discord ? { type: "discord", label: "Discord", url: metadata.publication.discord } : null,
    ].filter(Boolean),
  };
}
