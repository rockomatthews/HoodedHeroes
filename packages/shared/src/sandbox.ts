export type SandboxRuntime = "web-evm-v1" | "solana-v1";
export type SandboxStatus = "creating" | "ready" | "running" | "stopped" | "failed" | "expired";
export type SandboxCommandPreset = "install" | "typecheck" | "test" | "build" | "contract-test" | "security-scan";

export type SandboxLimits = {
  timeoutMs: number;
  maxOutputBytes: number;
  vcpus: number;
  memoryMb: number;
  exposedPorts: number;
};

export const DEFAULT_SANDBOX_LIMITS: SandboxLimits = {
  timeoutMs: 10 * 60 * 1000,
  maxOutputBytes: 1_000_000,
  vcpus: 2,
  memoryMb: 4_096,
  exposedPorts: 1,
};

export const APPROVED_SANDBOX_REPOSITORIES = [
  "rockomatthews/HOODED",
] as const;

export type SandboxSession = {
  id: string;
  owner: `0x${string}`;
  repository: (typeof APPROVED_SANDBOX_REPOSITORIES)[number];
  baseCommit: string;
  runtime: SandboxRuntime;
  limits: SandboxLimits;
  status: SandboxStatus;
  previewUrl?: string;
  snapshotId?: string;
  expiresAt: string;
};

export type SandboxRun = {
  id: string;
  sessionId: string;
  preset: SandboxCommandPreset;
  inputHash: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  startedAt: string;
  finishedAt?: string;
};

export type ContributionProposal = {
  id: string;
  sessionId: string;
  branch: `codex/${string}`;
  commitSha: string;
  buildHash: string;
  testEvidence: string[];
  signedOffBy: `0x${string}`;
  status: "draft" | "checks-passed" | "peer-reviewed" | "security-approved" | "merged" | "rejected";
};
