export type LaunchMode = "fixed" | "bonding";
export type LegacyLaunchQuoteAsset = "ETH" | "HERO";

export type LaunchProposal = {
  name: string;
  symbol: string;
  supply: number;
  mode: LaunchMode;
  quoteAsset: LegacyLaunchQuoteAsset;
  creatorAllocationBps: number;
  liquidityAllocationBps: number;
  vestingMonths: number;
  walletCapBps: number;
  minimumRaise: number;
  graduationThreshold: number;
  fixedSupply: boolean;
  liquidityLocked: boolean;
  transferTaxBps: number;
  hiddenMint: boolean;
  blacklist: boolean;
};

export type LaunchPolicyCheck = {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
};

export const DEFAULT_LAUNCH_PROPOSAL: LaunchProposal = {
  name: "Night Signal",
  symbol: "SIGNAL",
  supply: 1_000_000_000,
  mode: "bonding",
  quoteAsset: "HERO",
  creatorAllocationBps: 750,
  liquidityAllocationBps: 7000,
  vestingMonths: 12,
  walletCapBps: 200,
  minimumRaise: 100_000,
  graduationThreshold: 500_000,
  fixedSupply: true,
  liquidityLocked: true,
  transferTaxBps: 0,
  hiddenMint: false,
  blacklist: false,
};

export function validateLaunchProposal(proposal: LaunchProposal) {
  const symbol = proposal.symbol.trim();
  const allocationTotal = proposal.creatorAllocationBps + proposal.liquidityAllocationBps;
  const checks: LaunchPolicyCheck[] = [
    { id: "identity", label: "Token identity", passed: proposal.name.trim().length >= 2 && /^[A-Z0-9]{2,10}$/.test(symbol), detail: "Name required; symbol must be 2–10 uppercase letters or numbers." },
    { id: "supply", label: "Immutable fixed supply", passed: proposal.fixedSupply && Number.isSafeInteger(proposal.supply) && proposal.supply > 0, detail: "Supply must be a positive integer with no future mint authority." },
    { id: "creator", label: "Creator allocation ≤ 10%", passed: proposal.creatorAllocationBps >= 0 && proposal.creatorAllocationBps <= 1000, detail: "Creator allocation cannot exceed 1,000 basis points." },
    { id: "vesting", label: "Creator vesting ≥ 12 months", passed: proposal.creatorAllocationBps === 0 || proposal.vestingMonths >= 12, detail: "Any creator allocation must vest for at least twelve months." },
    { id: "liquidity", label: "Permanent liquidity lock", passed: proposal.liquidityLocked && proposal.liquidityAllocationBps >= 6000 && allocationTotal <= 10000, detail: "At least 60% is reserved for locked liquidity; allocations cannot exceed supply." },
    { id: "cap", label: "Wallet contribution cap", passed: proposal.walletCapBps >= 1 && proposal.walletCapBps <= 500, detail: "One wallet may receive at most 5% during launch." },
    { id: "raise", label: "Minimum raise and graduation", passed: proposal.minimumRaise > 0 && proposal.graduationThreshold >= proposal.minimumRaise, detail: "Graduation must meet or exceed the refundable minimum raise." },
    { id: "transfer", label: "No mutable transfer tax", passed: proposal.transferTaxBps === 0, detail: "V1 launches cannot impose a transfer tax." },
    { id: "control", label: "No hidden control paths", passed: !proposal.hiddenMint && !proposal.blacklist, detail: "Hidden minting and blacklist controls are prohibited." },
  ];

  return {
    checks,
    passed: checks.filter((check) => check.passed).length,
    total: checks.length,
    ready: checks.every((check) => check.passed),
    publicAllocationBps: Math.max(0, 10000 - allocationTotal),
  };
}
