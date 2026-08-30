import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { Sandbox } from "@vercel/sandbox";
import { APPROVED_SANDBOX_REPOSITORIES, DEFAULT_SANDBOX_LIMITS, type SandboxCommandPreset, type SandboxRuntime } from "@hoodedheroes/shared";

const REPOSITORY_URLS = {
  "rockomatthews/HoodedHeroes": "https://github.com/rockomatthews/HoodedHeroes.git",
} as const;

const PRESET_COMMANDS: Record<SandboxCommandPreset, { cmd: string; args: string[] }> = {
  install: { cmd: "pnpm", args: ["install", "--frozen-lockfile", "--ignore-scripts"] },
  typecheck: { cmd: "pnpm", args: ["typecheck"] },
  test: { cmd: "pnpm", args: ["test"] },
  build: { cmd: "pnpm", args: ["build"] },
  "contract-test": { cmd: "pnpm", args: ["--filter", "@hoodedheroes/contracts", "test"] },
  "security-scan": { cmd: "pnpm", args: ["audit", "--audit-level", "high"] },
};

export function sandboxEnabled() {
  return process.env.ENABLE_VERCEL_SANDBOX === "true";
}

export async function createCommunitySandbox(input: { repository: string; baseCommit: string; runtime: SandboxRuntime }) {
  if (!sandboxEnabled()) throw new Error("Community sandbox is disabled until Vercel Sandbox credentials and the production gate are configured");
  if (!APPROVED_SANDBOX_REPOSITORIES.includes(input.repository as (typeof APPROVED_SANDBOX_REPOSITORIES)[number])) throw new Error("Repository is not approved");
  if (!/^[a-f0-9]{7,40}$/i.test(input.baseCommit)) throw new Error("Invalid base commit");
  const snapshotId = input.runtime === "solana-v1" ? process.env.SOLANA_SANDBOX_SNAPSHOT_ID : process.env.WEB_EVM_SANDBOX_SNAPSHOT_ID;
  const common = { runtime: "node24" as const, timeout: DEFAULT_SANDBOX_LIMITS.timeoutMs, resources: { vcpus: DEFAULT_SANDBOX_LIMITS.vcpus }, ports: [3000] };
  const sandbox = snapshotId
    ? await Sandbox.create({ ...common, source: { type: "snapshot", snapshotId }, networkPolicy: "deny-all" })
    : await Sandbox.create({ ...common, source: { type: "git", url: REPOSITORY_URLS[input.repository as keyof typeof REPOSITORY_URLS], revision: input.baseCommit, depth: 1 }, networkPolicy: { allow: ["github.com", "*.githubusercontent.com", "registry.npmjs.org", "*.npmjs.org"] } });
  if (!snapshotId) await sandbox.updateNetworkPolicy("deny-all");
  return {
    id: randomUUID(),
    providerSessionId: sandbox.sandboxId,
    status: sandbox.status,
    previewUrl: sandbox.domain(3000),
    expiresAt: new Date(Date.now() + DEFAULT_SANDBOX_LIMITS.timeoutMs).toISOString(),
  };
}

export async function runSandboxPreset(providerSessionId: string, preset: SandboxCommandPreset) {
  if (!sandboxEnabled()) throw new Error("Community sandbox is disabled");
  const sandbox = await Sandbox.get({ sandboxId: providerSessionId });
  const command = PRESET_COMMANDS[preset];
  const installing = preset === "install";
  await sandbox.updateNetworkPolicy(installing ? { allow: ["registry.npmjs.org", "*.npmjs.org"] } : "deny-all");
  try {
    const result = await sandbox.runCommand({ ...command, cwd: "/vercel/sandbox" });
    const [stdout, stderr] = await Promise.all([result.stdout(), result.stderr()]);
    const boundedOut = stdout.slice(0, DEFAULT_SANDBOX_LIMITS.maxOutputBytes);
    const boundedErr = stderr.slice(0, DEFAULT_SANDBOX_LIMITS.maxOutputBytes);
    return {
      id: result.cmdId,
      preset,
      exitCode: result.exitCode,
      stdout: boundedOut,
      stderr: boundedErr,
      outputHash: createHash("sha256").update(boundedOut).update(boundedErr).digest("hex"),
    };
  } finally {
    await sandbox.updateNetworkPolicy("deny-all");
  }
}
