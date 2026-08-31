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
      extensions: { launchPage: metadata.canonicalLaunchUrl, buildHash: metadata.buildHash },
    }],
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
