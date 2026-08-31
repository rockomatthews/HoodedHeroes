export type LaunchChain = "robinhood" | "base" | "solana";
export type LaunchEnvironment = "testnet" | "mainnet-candidate";
export type LaunchQuoteAsset = "ETH" | "SOL" | "USDC" | "USDG" | "HOODED";
export type LaunchLifecycle =
  | "draft"
  | "metadata-validated"
  | "sandbox-passed"
  | "peer-reviewed"
  | "security-approved"
  | "timelocked"
  | "testnet-proven"
  | "mainnet-eligible";

export type LaunchMetadataV1 = {
  schemaVersion: "1.0.0";
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
    timestamp: string;
    changeReason: string;
    frozen: boolean;
  };
};

export type LaunchManifestV1 = {
  manifestVersion: "1.0.0";
  environment: LaunchEnvironment;
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
  };
  liquidity: {
    venue: "uniswap-v4" | "raydium-cpmm";
    permanentlyLocked: true;
  };
};

export type ManifestCheck = { id: string; label: string; passed: boolean; detail: string };

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
  const checks: ManifestCheck[] = [
    { id: "identity", label: "Canonical identity", passed: metadata.name.trim().length >= 2 && /^[A-Z0-9]{2,10}$/.test(metadata.symbol), detail: "Name is required and symbol must contain 2–10 uppercase letters or numbers." },
    { id: "supply", label: "Exact fixed supply", passed: isIntegerString(metadata.exactSupply) && BigInt(metadata.exactSupply) > 0n && immutableAuthorities, detail: "Supply must be an exact positive integer and all prohibited authorities must be absent." },
    { id: "allocation", label: "Allocation conservation", passed: allocationTotal === 10_000 && sale.creatorAllocationBps <= 1_000, detail: "Allocations must equal 100% and creator allocation cannot exceed 10%." },
    { id: "vesting", label: "Creator vesting", passed: sale.creatorAllocationBps === 0 || manifest.vesting.creatorMonths >= 12, detail: "Creator allocations vest for at least 12 months." },
    { id: "window", label: "Timed fair launch", passed: Number.isFinite(startsAt) && Number.isFinite(endsAt) && endsAt > startsAt, detail: "The contribution window must have valid increasing timestamps." },
    { id: "raise", label: "Raise and wallet limits", passed: [sale.pricePerToken, sale.minimumRaise, sale.maximumRaise, sale.maximumContributionPerWallet].every(isIntegerString) && BigInt(sale.minimumRaise) > 0n && BigInt(sale.maximumRaise) >= BigInt(sale.minimumRaise) && BigInt(sale.maximumContributionPerWallet) > 0n, detail: "All monetary values use integer base units and must form valid caps." },
    { id: "quote", label: "Approved quote asset", passed: CHAIN_QUOTES[metadata.chain].includes(sale.quoteAsset), detail: "Quote asset must be approved for the selected chain." },
    { id: "fees", label: "Transparent capped fee", passed: fees.saleFeeBps >= 0 && fees.saleFeeBps <= 100 && fees.operationsShareBps + fees.rewardsShareBps + fees.referralShareBps === 10_000, detail: "Sale fee cannot exceed 1% and recipient shares must equal 100%." },
    { id: "liquidity", label: "Permanent liquidity", passed: manifest.liquidity.permanentlyLocked && (metadata.chain === "solana" ? manifest.liquidity.venue === "raydium-cpmm" : manifest.liquidity.venue === "uniswap-v4"), detail: "Liquidity must be permanently locked at the approved chain venue." },
    { id: "metadata", label: "Distribution metadata", passed: metadata.publication.summary.trim().length >= 20 && metadata.publication.description.trim().length >= 50 && metadata.publication.riskDisclosure.trim().length >= 20 && publicationUrls.every(isHttpUrl), detail: "Complete descriptive, risk, and valid distribution URLs are required." },
    { id: "build", label: "Reproducible source", passed: /^[a-f0-9]{7,64}$/i.test(metadata.sourceCommit) && /^[a-f0-9]{64}$/i.test(metadata.buildHash) && /^[a-f0-9]{64}$/i.test(metadata.revision.contentHash), detail: "Source commit, build hash, and metadata content hash must be published." },
    { id: "mainnet", label: "No automatic mainnet", passed: manifest.environment !== "mainnet-candidate" || manifest.lifecycle === "mainnet-eligible", detail: "Only a fully reviewed manifest may become a mainnet candidate." },
  ];

  return { checks, ready: checks.every((check) => check.passed), passed: checks.filter((check) => check.passed).length, total: checks.length };
}

export const HOODED_GENESIS_MANIFEST: LaunchManifestV1 = {
  manifestVersion: "1.0.0",
  environment: "testnet",
  lifecycle: "draft",
  metadata: {
    schemaVersion: "1.0.0",
    projectId: "hooded-genesis",
    chain: "robinhood",
    name: "HOODED",
    symbol: "HOODED",
    decimals: 18,
    exactSupply: "1000000000000000000000000000",
    creatorWallet: "0x0000000000000000000000000000000000000000",
    sourceCommit: "0000000",
    buildHash: "0".repeat(64),
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
      image: "ipfs://pending-hero-icon",
    },
    revision: { version: 1, contentHash: "0".repeat(64), authorWallet: "0x0000000000000000000000000000000000000000", timestamp: "2026-08-30T00:00:00.000Z", changeReason: "Initial testnet genesis manifest", frozen: false },
  },
  sale: {
    mode: "fixed-price-pro-rata",
    saleAllocationBps: 4_000,
    liquidityAllocationBps: 1_500,
    creatorAllocationBps: 500,
    rewardsAllocationBps: 3_000,
    treasuryAllocationBps: 1_000,
    pricePerToken: "1",
    minimumRaise: "1",
    maximumRaise: "400000000000000000000000000",
    maximumContributionPerWallet: "10000000000000000000000000",
    startsAt: "2026-10-01T16:00:00.000Z",
    endsAt: "2026-10-03T16:00:00.000Z",
    quoteAsset: "ETH",
  },
  vesting: { creatorMonths: 24, contributorMonths: 24 },
  fees: { saleFeeBps: 75, operationsShareBps: 5_000, rewardsShareBps: 3_000, referralShareBps: 2_000 },
  liquidity: { venue: "uniswap-v4", permanentlyLocked: true },
};

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
