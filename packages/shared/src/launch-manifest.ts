export type LaunchChain = "robinhood" | "base" | "solana";
export type LaunchEnvironment = "mainnet-canary" | "mainnet";
export type LaunchClass = "lab" | "production";
export type LaunchQuoteAsset = "ETH" | "SOL" | "USDC" | "USDG" | "HOODED";
export type LaunchLifecycle =
  | "draft"
  | "metadata-validated"
  | "sandbox-passed"
  | "peer-reviewed"
  | "security-approved"
  | "fork-proven"
  | "simulation-passed"
  | "canary-ready"
  | "mainnet-verified"
  | "public-eligible";

export type LaunchMetadataV1 = {
  schemaVersion: "1.4.0";
  launcher: "Hooded";
  projectId: string;
  chain: LaunchChain;
  tokenAddress?: string;
  name: string;
  symbol: string;
  decimals: number;
  exactSupply: string;
  creatorWallet: string;
  sourceCommit: string;
  buildHash: string;
  immutableCoreHash: string;
  factoryVersion: "1.7.0";
  license: "AGPL-3.0-or-later";
  canonicalLaunchUrl: string;
  explorerUrl?: string;
  authorities: {
    futureMint: false;
    freeze: false;
    blacklist: false;
    mutableTax: false;
    arbitraryUpgrade: false;
  };
  publication: {
    summary: string;
    description: string;
    utility: string;
    categories: string[];
    website: string;
    docs?: string;
    x?: string;
    telegram?: string;
    discord?: string;
    farcaster?: string;
    support?: string;
    riskDisclosure: string;
    jurisdictionNotice: string;
    teamDisclosure: "pseudonymous" | "public";
    image: string;
    header?: string;
  };
  revision: {
    version: number;
    previousContentHash?: string;
    contentHash: string;
    authorWallet: string;
    signature: string;
    timestamp: string;
    changeReason: string;
    frozen: boolean;
  };
};

export type LaunchManifestV1 = {
  manifestVersion: "1.4.0";
  environment: LaunchEnvironment;
  launchClass: LaunchClass;
  lifecycle: LaunchLifecycle;
  metadata: LaunchMetadataV1;
  sale: {
    mode: "fixed-price-pro-rata";
    saleAllocationBps: number;
    liquidityAllocationBps: number;
    creatorAllocationBps: number;
    rewardsAllocationBps: number;
    treasuryAllocationBps: number;
    pricePerToken: string;
    minimumRaise: string;
    maximumRaise: string;
    maximumContributionPerWallet: string;
    startsAt: string;
    endsAt: string;
    quoteAsset: LaunchQuoteAsset;
    liquidityQuoteShareBps: number;
  };
  vesting: {
    creatorMonths: number;
    contributorMonths: number;
  };
  fees: {
    saleFeeBps: number;
    operationsShareBps: 5_000;
    rewardsShareBps: 3_000;
    referralShareBps: 2_000;
    rewardsRecipient: string;
  };
  liquidity: {
    venue: "none" | "uniswap-v4" | "raydium-cpmm";
    permanentlyLocked: true;
  };
  eligibility: {
    required: boolean;
    permitStandard: "eip712-launch-v1" | "none";
    claimsAndRefundsPermissionless: true;
  };
  canary: {
    creatorAccess: "single-wallet" | "approved-creator";
    sealedAtCreation: true;
    separatePublicActivation: true;
    mainnetForkRequired: true;
    transactionSimulationRequired: true;
  };
};

export type ManifestCheck = { id: string; label: string; passed: boolean; detail: string };

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
}

export function metadataRevisionPayload(metadata: LaunchMetadataV1) {
  const { contentHash: _contentHash, signature: _signature, ...revision } = metadata.revision;
  return { ...metadata, revision };
}

export function launchMetadataImmutableCore(metadata: LaunchMetadataV1) {
  const { publication: _publication, revision: _revision, immutableCoreHash: _immutableCoreHash, ...core } = metadata;
  return core;
}

export function metadataRevisionAttestation(metadata: LaunchMetadataV1) {
  return [
    "HOODED LAUNCH METADATA REVISION",
    `Project: ${metadata.projectId}`,
    `Version: ${metadata.revision.version}`,
    `Content: ${metadata.revision.contentHash.toLowerCase()}`,
    `Previous: ${metadata.revision.previousContentHash?.toLowerCase() ?? "GENESIS"}`,
    `Reason: ${metadata.revision.changeReason}`,
  ].join("\n");
}

const CHAIN_QUOTES: Record<LaunchChain, readonly LaunchQuoteAsset[]> = {
  robinhood: ["ETH", "USDG", "HOODED"],
  base: ["ETH", "USDC"],
  solana: ["SOL", "USDC"],
};

const isIntegerString = (value: string) => /^(0|[1-9]\d*)$/.test(value);
const isHttpUrl = (value: string) => {
  try {
    const protocol = new URL(value).protocol;
    return protocol === "https:" || protocol === "ipfs:" || protocol === "ar:";
  } catch {
    return false;
  }
};

export function validateLaunchManifest(manifest: LaunchManifestV1) {
  const { metadata, sale, fees } = manifest;
  const allocationTotal = sale.saleAllocationBps + sale.liquidityAllocationBps + sale.creatorAllocationBps + sale.rewardsAllocationBps + sale.treasuryAllocationBps;
  const startsAt = Date.parse(sale.startsAt);
  const endsAt = Date.parse(sale.endsAt);
  const immutableAuthorities = Object.values(metadata.authorities).every((value) => value === false);
  const publicationUrls = [metadata.publication.website, metadata.publication.image, metadata.publication.docs, metadata.publication.x, metadata.publication.telegram, metadata.publication.discord, metadata.publication.farcaster, metadata.publication.support, metadata.publication.header].filter((value): value is string => Boolean(value));
  const hasPlaceholderMetadata = publicationUrls.some((value) => /pending|placeholder|example\.com/i.test(value));
  const hasReproducibleBuild = /^[a-f0-9]{7,64}$/i.test(metadata.sourceCommit)
    && !/^0+$/i.test(metadata.sourceCommit)
    && /^[a-f0-9]{64}$/i.test(metadata.buildHash)
    && !/^0+$/i.test(metadata.buildHash)
    && /^[a-f0-9]{64}$/i.test(metadata.immutableCoreHash)
    && !/^0+$/i.test(metadata.immutableCoreHash)
    && /^[a-f0-9]{64}$/i.test(metadata.revision.contentHash)
    && !/^0+$/i.test(metadata.revision.contentHash)
    && /^0x[a-f0-9]{130}$/i.test(metadata.revision.signature);
  const monetaryValues = [sale.pricePerToken, sale.minimumRaise, sale.maximumRaise, sale.maximumContributionPerWallet];
  const fixedPriceMatches = metadata.chain === "solana" || (
    isIntegerString(metadata.exactSupply)
    && monetaryValues.every(isIntegerString)
    && BigInt(metadata.exactSupply) * BigInt(sale.saleAllocationBps) % 10_000n === 0n
    && (BigInt(metadata.exactSupply) * BigInt(sale.saleAllocationBps) / 10_000n) * BigInt(sale.pricePerToken) / 10n ** 18n === BigInt(sale.maximumRaise)
  );
  const checks: ManifestCheck[] = [
    { id: "launcher", label: "Canonical launcher", passed: metadata.launcher === "Hooded", detail: "Every launch must identify Hooded as its canonical launcher." },
    { id: "identity", label: "Canonical identity", passed: metadata.name.trim().length >= 2 && /^[A-Z0-9]{2,10}$/.test(metadata.symbol), detail: "Name is required and symbol must contain 2–10 uppercase letters or numbers." },
    { id: "creator", label: "Bound canary creator", passed: /^0x[a-fA-F0-9]{40}$/.test(metadata.creatorWallet) && !/^0x0{40}$/i.test(metadata.creatorWallet), detail: "The manifest must bind one nonzero EVM creator wallet; the server and factory independently enforce the same address." },
    { id: "supply", label: "Exact fixed supply", passed: isIntegerString(metadata.exactSupply) && BigInt(metadata.exactSupply) > 0n && immutableAuthorities, detail: "Supply must be an exact positive integer and all prohibited authorities must be absent." },
    { id: "allocation", label: "Allocation conservation", passed: allocationTotal === 10_000 && sale.creatorAllocationBps <= 1_000, detail: "Allocations must equal 100% and creator allocation cannot exceed 10%." },
    { id: "vesting", label: "Creator vesting", passed: sale.creatorAllocationBps === 0 || manifest.vesting.creatorMonths >= 12, detail: "Creator allocations vest for at least 12 months." },
    { id: "window", label: "Timed fair launch", passed: Number.isFinite(startsAt) && Number.isFinite(endsAt) && endsAt > startsAt, detail: "The contribution window must have valid increasing timestamps." },
    { id: "raise", label: "Fixed price and wallet limits", passed: monetaryValues.every(isIntegerString) && BigInt(sale.minimumRaise) > 0n && BigInt(sale.maximumRaise) >= BigInt(sale.minimumRaise) && BigInt(sale.maximumContributionPerWallet) > 0n && fixedPriceMatches, detail: "All monetary values use integer base units; EVM price × sale allocation must exactly equal the maximum raise." },
    { id: "quote", label: "Approved quote asset", passed: CHAIN_QUOTES[metadata.chain].includes(sale.quoteAsset), detail: "Quote asset must be approved for the selected chain." },
    { id: "fees", label: "Transparent capped fee", passed: fees.saleFeeBps >= 0 && fees.saleFeeBps <= 100 && fees.operationsShareBps + fees.rewardsShareBps + fees.referralShareBps === 10_000 && /^0x[a-fA-F0-9]{40}$/.test(fees.rewardsRecipient) && !/^0x0{40}$/i.test(fees.rewardsRecipient), detail: "Sale fee cannot exceed 1%, recipient shares must equal 100%, and the immutable Hero reward vault must be published." },
    { id: "liquidity", label: "Permanent liquidity", passed: manifest.launchClass === "lab" ? manifest.liquidity.venue === "none" : manifest.liquidity.permanentlyLocked && sale.liquidityQuoteShareBps === 3_750 && (metadata.chain === "solana" ? manifest.liquidity.venue === "raydium-cpmm" : manifest.liquidity.venue === "uniswap-v4"), detail: "Production liquidity uses 37.5% of accepted quote and must be permanently locked at the approved chain venue; lab launches create no public pool." },
    { id: "eligibility", label: "Contribution eligibility", passed: manifest.eligibility.claimsAndRefundsPermissionless && (manifest.eligibility.required ? manifest.eligibility.permitStandard === "eip712-launch-v1" : manifest.eligibility.permitStandard === "none"), detail: "Contribution permits may gate new funds, but claims and refunds must remain permissionless." },
    { id: "metadata", label: "Distribution metadata", passed: metadata.publication.summary.trim().length >= 20 && metadata.publication.description.trim().length >= 50 && metadata.publication.riskDisclosure.trim().length >= 20 && publicationUrls.every(isHttpUrl) && !hasPlaceholderMetadata, detail: "Complete descriptive, risk, and valid non-placeholder distribution URLs are required." },
    { id: "build", label: "Reproducible source", passed: hasReproducibleBuild, detail: "Non-placeholder source commit, build hash, and metadata content hash must be published." },
    { id: "canary", label: "Sealed mainnet release", passed: (manifest.launchClass === "lab" ? manifest.environment === "mainnet-canary" && manifest.canary.creatorAccess === "single-wallet" : manifest.environment === "mainnet" && manifest.canary.creatorAccess === "approved-creator") && manifest.canary.sealedAtCreation && manifest.canary.separatePublicActivation && manifest.canary.mainnetForkRequired && manifest.canary.transactionSimulationRequired, detail: "Creation stays reviewed, sealed, fork-tested, simulated, and separate from public activation." },
  ];

  return { checks, ready: checks.every((check) => check.passed), passed: checks.filter((check) => check.passed).length, total: checks.length };
}

export const HOODED_GENESIS_MANIFEST: LaunchManifestV1 = {
  manifestVersion: "1.4.0",
  environment: "mainnet",
  launchClass: "production",
  lifecycle: "draft",
  metadata: {
    schemaVersion: "1.4.0",
    launcher: "Hooded",
    projectId: "hooded-genesis",
    chain: "robinhood",
    name: "HOODED",
    symbol: "HOODED",
    decimals: 18,
    exactSupply: "1000000000000000000000000000",
    creatorWallet: "0x0000000000000000000000000000000000000000",
    sourceCommit: "0000000",
    buildHash: "0".repeat(64),
    immutableCoreHash: "0".repeat(64),
    factoryVersion: "1.7.0",
    license: "AGPL-3.0-or-later",
    canonicalLaunchUrl: "https://hooded.world/launch/hooded-genesis",
    authorities: { futureMint: false, freeze: false, blacklist: false, mutableTax: false, arbitraryUpgrade: false },
    publication: {
      summary: "The fixed-supply access and utility token for the HOODED society.",
      description: "HOODED powers access, Genesis Hero minting, community rewards, and transparent governance across the society.",
      utility: "Society access, Genesis Hero minting, seasonal rewards, and governance participation.",
      categories: ["community", "gaming", "developer-tools"],
      website: "https://hooded.world",
      riskDisclosure: "Digital assets are risky and may lose all value. No return, liquidity, or listing is promised.",
      jurisdictionNotice: "Availability depends on applicable law, sanctions screening, and jurisdiction controls.",
      teamDisclosure: "pseudonymous",
      image: "https://hooded.world/brand/hooded-coin-emblem.png",
      header: "https://hooded.world/launch-assets/hooded/og-1200x630.png",
    },
    revision: { version: 1, contentHash: "0".repeat(64), authorWallet: "0x0000000000000000000000000000000000000000", signature: "0x", timestamp: "2026-08-30T00:00:00.000Z", changeReason: "Initial reviewed production manifest", frozen: false },
  },
  sale: {
    mode: "fixed-price-pro-rata",
    saleAllocationBps: 4_000,
    liquidityAllocationBps: 1_500,
    creatorAllocationBps: 500,
    rewardsAllocationBps: 3_000,
    treasuryAllocationBps: 1_000,
    pricePerToken: "25000000000",
    minimumRaise: "250000000000000000",
    maximumRaise: "10000000000000000000",
    maximumContributionPerWallet: "100000000000000000",
    startsAt: "2026-10-01T16:00:00.000Z",
    endsAt: "2026-10-03T16:00:00.000Z",
    quoteAsset: "ETH",
    liquidityQuoteShareBps: 3_750,
  },
  vesting: { creatorMonths: 24, contributorMonths: 24 },
  fees: { saleFeeBps: 75, operationsShareBps: 5_000, rewardsShareBps: 3_000, referralShareBps: 2_000, rewardsRecipient: "0x0000000000000000000000000000000000000000" },
  liquidity: { venue: "uniswap-v4", permanentlyLocked: true },
  eligibility: { required: true, permitStandard: "eip712-launch-v1", claimsAndRefundsPermissionless: true },
  canary: { creatorAccess: "approved-creator", sealedAtCreation: true, separatePublicActivation: true, mainnetForkRequired: true, transactionSimulationRequired: true },
};

function labManifest(projectId: "hlab1" | "hlab2", live: boolean): LaunchManifestV1 {
  const symbol = projectId.toUpperCase();
  return {
    ...structuredClone(HOODED_GENESIS_MANIFEST),
    environment: "mainnet-canary",
    launchClass: "lab",
    lifecycle: "draft",
    metadata: {
      ...structuredClone(HOODED_GENESIS_MANIFEST.metadata),
      projectId,
      name: `HOODED LAB ${projectId === "hlab1" ? "01" : "02"}`,
      symbol,
      exactSupply: "1000000000000000000000000",
      canonicalLaunchUrl: `https://hooded.world/launch/${projectId}`,
      publication: {
        ...structuredClone(HOODED_GENESIS_MANIFEST.metadata.publication),
        summary: `${symbol} is an owner-only HOODED metadata rehearsal with no promised value.`,
        description: `${symbol} exists solely to verify source, wallet display, metadata, settlement, and retirement evidence before the production HOODED launch.`,
        utility: "Experimental metadata and contract-flow rehearsal only. No value or liquidity is promised.",
        riskDisclosure: "EXPERIMENTAL // NO VALUE. This lab token has no public liquidity, financial promise, or production utility.",
      },
      revision: { ...structuredClone(HOODED_GENESIS_MANIFEST.metadata.revision), changeReason: "Initial owner-only lab manifest" },
    },
    sale: {
      ...structuredClone(HOODED_GENESIS_MANIFEST.sale),
      saleAllocationBps: 10_000,
      liquidityAllocationBps: 0,
      creatorAllocationBps: 0,
      rewardsAllocationBps: 0,
      treasuryAllocationBps: 0,
      pricePerToken: live ? "10000000000" : "1000000000",
      minimumRaise: live ? "1000000000000000" : "100000000000000",
      maximumRaise: live ? "10000000000000000" : "1000000000000000",
      maximumContributionPerWallet: live ? "10000000000000000" : "1000000000000000",
      liquidityQuoteShareBps: 0,
    },
    vesting: { creatorMonths: 0, contributorMonths: 0 },
    liquidity: { venue: "none", permanentlyLocked: true },
    eligibility: { required: true, permitStandard: "eip712-launch-v1", claimsAndRefundsPermissionless: true },
    canary: { creatorAccess: "single-wallet", sealedAtCreation: true, separatePublicActivation: true, mainnetForkRequired: true, transactionSimulationRequired: true },
  };
}

export const HLAB1_MANIFEST = labManifest("hlab1", false);
export const HLAB2_MANIFEST = labManifest("hlab2", true);

export type ContributionSimulation = {
  wallet: string;
  contributed: bigint;
  accepted: bigint;
  refund: bigint;
  tokenAllocation: bigint;
};

export function simulateProRataLaunch(input: {
  saleTokenAllocation: bigint;
  maximumRaise: bigint;
  contributions: { wallet: string; amount: bigint }[];
}) {
  if (input.saleTokenAllocation <= 0n || input.maximumRaise <= 0n) throw new Error("Simulation values must be positive");
  const totalContributed = input.contributions.reduce((sum, item) => sum + item.amount, 0n);
  const denominator = totalContributed > input.maximumRaise ? totalContributed : input.maximumRaise;
  const wallets: ContributionSimulation[] = input.contributions.map(({ wallet, amount }) => {
    if (amount < 0n) throw new Error("Contribution cannot be negative");
    const accepted = totalContributed > input.maximumRaise && totalContributed > 0n ? input.maximumRaise * amount / totalContributed : amount;
    return { wallet, contributed: amount, accepted, refund: amount - accepted, tokenAllocation: input.saleTokenAllocation * amount / denominator };
  });
  return {
    totalContributed,
    totalAccepted: wallets.reduce((sum, item) => sum + item.accepted, 0n),
    totalRefunded: wallets.reduce((sum, item) => sum + item.refund, 0n),
    totalTokensAllocated: wallets.reduce((sum, item) => sum + item.tokenAllocation, 0n),
    wallets,
  };
}
