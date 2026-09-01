export type BazaarWorkstream = {
  id: string;
  label: string;
  path: string;
  stage: "implemented" | "hardening" | "planned";
  checks: readonly string[];
};

export type BazaarBounty = {
  id: string;
  title: string;
  discipline: "contracts" | "frontend" | "security" | "solana" | "metadata";
  priority: "critical" | "high" | "normal";
  evidence: string;
};

export const LAUNCH_BAY_PROJECT = {
  slug: "launch-bay",
  name: "Launch Bay",
  codename: "FOUNDRY-01",
  version: "0.2.0-mainnet-canary",
  license: "AGPL-3.0-or-later",
  repository: "rockomatthews/HOODED",
  branchPolicy: "pull-request-only",
  mission: "Build the society's auditable fair-launch system and use the same owner-only canary pipeline for the fixed one-billion-supply HOODED genesis launch.",
  releaseGate: "No transaction is broadcast automatically. Mainnet creation requires local and fork tests, simulation, independent review, and the configured owner's explicit wallet signature.",
  workstreams: [
    { id: "launcher-core", label: "Launcher Core", path: "packages/contracts/src", stage: "hardening", checks: ["Foundry fuzz", "supply invariants", "refund invariants"] },
    { id: "manifest-studio", label: "Manifest Studio", path: "packages/shared/src/launch-manifest.ts", stage: "implemented", checks: ["13 policy gates", "golden vectors", "metadata formats"] },
    { id: "hero-genesis", label: "HOODED Genesis", path: "packages/contracts/src/HoodedToken.sol", stage: "hardening", checks: ["1B fixed supply", "no mint authority", "Hero purchase integration"] },
    { id: "solana-adapter", label: "Solana Adapter", path: "programs/launch-bay", stage: "planned", checks: ["program-test", "authority revocation", "Raydium migration"] },
  ] satisfies readonly BazaarWorkstream[],
  bounties: [
    { id: "LB-001", title: "Prove conservation across every claim and refund order", discipline: "security", priority: "critical", evidence: "Foundry invariant suite" },
    { id: "LB-002", title: "Add immutable creator and contributor vesting vaults", discipline: "contracts", priority: "high", evidence: "fuzz tests plus bytecode hash" },
    { id: "LB-003", title: "Create RH Chain and Base mainnet-fork rehearsals", discipline: "contracts", priority: "high", evidence: "decoded unsigned transactions and fork receipts" },
    { id: "LB-004", title: "Build independent Solana allocation adapter", discipline: "solana", priority: "high", evidence: "shared golden vectors" },
    { id: "LB-005", title: "Validate social cards and token-list export package", discipline: "metadata", priority: "normal", evidence: "asset hashes and schema reports" },
  ] satisfies readonly BazaarBounty[],
  contributionFlow: ["Fork approved source", "Run isolated sandbox", "Attach test evidence", "Open signed pull request", "Peer review", "Security approval"],
} as const;
