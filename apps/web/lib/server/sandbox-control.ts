import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { posix } from "node:path";
import { Sandbox } from "@vercel/sandbox";
import { DEFAULT_SANDBOX_LIMITS, type SandboxCommandPreset, type SandboxRuntime } from "@hooded/shared";
import { approvedGitHubRepository } from "@/lib/server/github-control";

const PRESET_COMMANDS: Record<SandboxCommandPreset, { cmd: string; args: string[] }> = {
  install: { cmd: "pnpm", args: ["install", "--frozen-lockfile", "--ignore-scripts"] },
  typecheck: { cmd: "pnpm", args: ["typecheck"] },
  test: { cmd: "pnpm", args: ["test"] },
  build: { cmd: "pnpm", args: ["build"] },
  "contract-test": { cmd: "pnpm", args: ["--filter", "@hooded/contracts", "test"] },
  "security-scan": { cmd: "pnpm", args: ["audit", "--audit-level", "high"] },
};

const SANDBOX_ROOT = "/vercel/sandbox";
const MAX_EDIT_BYTES = 256 * 1024;
const BLOCKED_SEGMENTS = new Set([".git", ".env", ".env.local", "node_modules", ".next"]);

function approvedFilePath(input: string) {
  if (!input || input.length > 240 || input.includes("\0") || input.includes("\\")) throw new Error("Invalid sandbox file path");
  const normalized = posix.normalize(input).replace(/^\.\//, "");
  if (normalized.startsWith("../") || normalized.startsWith("/") || normalized === "..") throw new Error("Sandbox file path escapes the repository");
  if (normalized.split("/").some((segment) => BLOCKED_SEGMENTS.has(segment) || segment.startsWith(".env"))) throw new Error("Protected sandbox path");
  return `${SANDBOX_ROOT}/${normalized}`;
}

export function sandboxEnabled() {
  return process.env.ENABLE_VERCEL_SANDBOX === "true";
}

export async function createCommunitySandbox(input: { repository: string; baseCommit: string; runtime: SandboxRuntime }) {
  if (!sandboxEnabled()) throw new Error("Community sandbox is disabled until Vercel Sandbox credentials and the production gate are configured");
  if (input.repository !== approvedGitHubRepository()) throw new Error("Repository is not approved");
  if (!/^[a-f0-9]{7,40}$/i.test(input.baseCommit)) throw new Error("Invalid base commit");
  const snapshotId = input.runtime === "solana-v1" ? process.env.SOLANA_SANDBOX_SNAPSHOT_ID : process.env.WEB_EVM_SANDBOX_SNAPSHOT_ID;
  if (!snapshotId) throw new Error("A reviewed versioned sandbox snapshot is required");
  const common = { runtime: "node24" as const, timeout: DEFAULT_SANDBOX_LIMITS.timeoutMs, resources: { vcpus: DEFAULT_SANDBOX_LIMITS.vcpus }, ports: [3000] };
  const sandbox = await Sandbox.create({ ...common, source: { type: "snapshot", snapshotId }, networkPolicy: "deny-all" });
  return {
    id: randomUUID(),
    providerSessionId: sandbox.sandboxId,
    status: sandbox.status,
    previewUrl: sandbox.domain(3000),
    expiresAt: new Date(Date.now() + DEFAULT_SANDBOX_LIMITS.timeoutMs).toISOString(),
  };
}

export async function stopCommunitySandbox(providerSessionId: string) {
  const sandbox = await Sandbox.get({ sandboxId: providerSessionId });
  await sandbox.stop();
  return { stopped: true, providerSessionId };
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

export async function readSandboxFile(providerSessionId: string, requestedPath: string) {
  const sandbox = await Sandbox.get({ sandboxId: providerSessionId });
  const path = approvedFilePath(requestedPath);
  const root = await sandbox.fs.realpath(SANDBOX_ROOT);
  const resolved = await sandbox.fs.realpath(path);
  if (resolved !== root && !resolved.startsWith(`${root}/`)) throw new Error("Sandbox file path escapes the repository");
  const stat = await sandbox.fs.lstat(path);
  if (stat.isSymbolicLink() || !stat.isFile() || stat.size > MAX_EDIT_BYTES) throw new Error("Sandbox file is not an editable regular file");
  return { path: requestedPath, content: await sandbox.fs.readFile(path, "utf8"), bytes: stat.size };
}

export async function writeSandboxFile(providerSessionId: string, requestedPath: string, content: string) {
  const bytes = Buffer.byteLength(content);
  if (bytes > MAX_EDIT_BYTES) throw new Error("Sandbox edit exceeds the 256 KiB limit");
  const sandbox = await Sandbox.get({ sandboxId: providerSessionId });
  const path = approvedFilePath(requestedPath);
  const root = await sandbox.fs.realpath(SANDBOX_ROOT);
  const parent = await sandbox.fs.realpath(posix.dirname(path));
  if (parent !== root && !parent.startsWith(`${root}/`)) throw new Error("Sandbox file path escapes the repository");
  if (await sandbox.fs.exists(path)) {
    const stat = await sandbox.fs.lstat(path);
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error("Sandbox target is not an editable regular file");
  }
  await sandbox.fs.writeFile(path, content, "utf8");
  return { path: requestedPath, bytes, contentHash: createHash("sha256").update(content).digest("hex") };
}
