import { Sandbox } from "@vercel/sandbox";
import { createSign } from "node:crypto";

if (process.env.SANDBOX_SNAPSHOT_BUILD_APPROVED !== "true") {
  throw new Error("Snapshot creation is disabled. Set SANDBOX_SNAPSHOT_BUILD_APPROVED=true only for a reviewed build.");
}

function pinned(name, pattern = /^[a-zA-Z0-9._+-]+$/) {
  const value = process.env[name];
  if (!value || !pattern.test(value)) throw new Error(`${name} must be an explicitly pinned, valid value`);
  return value;
}

const versions = {
  pnpm: pinned("SANDBOX_PNPM_VERSION", /^\d+\.\d+\.\d+$/),
  cyclonedx: pinned("SANDBOX_CYCLONEDX_VERSION", /^\d+\.\d+\.\d+$/),
  semgrep: pinned("SANDBOX_SEMGREP_VERSION", /^\d+\.\d+\.\d+$/),
  foundry: pinned("SANDBOX_FOUNDRY_VERSION"),
  rust: pinned("SANDBOX_RUST_TOOLCHAIN"),
  solana: pinned("SANDBOX_SOLANA_VERSION", /^\d+\.\d+\.\d+$/),
  anchor: pinned("SANDBOX_ANCHOR_VERSION", /^\d+\.\d+\.\d+$/),
};

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

async function githubInstallationToken() {
  const now = Math.floor(Date.now() / 1_000);
  const unsigned = `${base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64url(JSON.stringify({ iat: now - 30, exp: now + 540, iss: required("GITHUB_APP_ID") }))}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  const jwt = `${unsigned}.${signer.sign(required("GITHUB_APP_PRIVATE_KEY").replaceAll("\\n", "\n")).toString("base64url")}`;
  const response = await fetch(`https://api.github.com/app/installations/${required("GITHUB_APP_INSTALLATION_ID")}/access_tokens`, {
    method: "POST",
    headers: { accept: "application/vnd.github+json", authorization: `Bearer ${jwt}`, "x-github-api-version": "2022-11-28" },
  });
  if (!response.ok) throw new Error(`GitHub installation token request failed (${response.status})`);
  const result = await response.json();
  if (!result.token) throw new Error("GitHub installation token response was incomplete");
  return result.token;
}

const repository = required("GITHUB_REPOSITORY");
const baseCommit = required("SANDBOX_BASE_COMMIT");
if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository) || !/^[a-fA-F0-9]{40}$/.test(baseCommit)) {
  throw new Error("The approved repository or full base commit is invalid");
}
const installationToken = await githubInstallationToken();
const reviewedSource = {
  type: "git",
  url: `https://github.com/${repository}.git`,
  username: "x-access-token",
  password: installationToken,
  depth: 1,
  revision: baseCommit,
};

const credentials = process.env.VERCEL_TOKEN && process.env.VERCEL_TEAM_ID && process.env.VERCEL_PROJECT_ID
  ? { token: process.env.VERCEL_TOKEN, teamId: process.env.VERCEL_TEAM_ID, projectId: process.env.VERCEL_PROJECT_ID }
  : {};

async function command(sandbox, cmd, args) {
  const result = await sandbox.runCommand({ cmd, args, cwd: "/vercel/sandbox" });
  if (result.exitCode !== 0) throw new Error(`${cmd} failed: ${(await result.stderr()).slice(-2_000)}`);
}

async function createWebEvm() {
  const sandbox = await Sandbox.create({ ...credentials, source: reviewedSource, runtime: "node24", timeout: 600_000, networkPolicy: { allow: ["github.com", "*.githubusercontent.com", "registry.npmjs.org", "*.npmjs.org", "foundry.paradigm.xyz", "pypi.org", "files.pythonhosted.org"] } });
  try {
    await command(sandbox, "sh", ["-lc", `corepack enable && corepack prepare pnpm@${versions.pnpm} --activate && npm install -g @cyclonedx/cyclonedx-npm@${versions.cyclonedx}`]);
    await command(sandbox, "sh", ["-lc", `python3 -m pip install --user semgrep==${versions.semgrep}`]);
    await command(sandbox, "sh", ["-lc", `curl -fsSL https://foundry.paradigm.xyz | bash && ~/.foundry/bin/foundryup -i ${versions.foundry}`]);
    const snapshot = await sandbox.snapshot();
    return snapshot.snapshotId;
  } finally {
    await sandbox.stop();
  }
}

async function createSolana() {
  const sandbox = await Sandbox.create({ ...credentials, source: reviewedSource, runtime: "node24", timeout: 900_000, networkPolicy: { allow: ["github.com", "*.githubusercontent.com", "registry.npmjs.org", "*.npmjs.org", "sh.rustup.rs", "static.rust-lang.org", "release.anza.xyz"] } });
  try {
    await command(sandbox, "sh", ["-lc", `corepack enable && corepack prepare pnpm@${versions.pnpm} --activate`]);
    await command(sandbox, "sh", ["-lc", `curl --proto '=https' --tlsv1.2 -fsSL https://sh.rustup.rs | sh -s -- -y --profile minimal --default-toolchain ${versions.rust}`]);
    await command(sandbox, "sh", ["-lc", `curl -fsSL https://release.anza.xyz/v${versions.solana}/install | sh`]);
    await command(sandbox, "sh", ["-lc", `~/.cargo/bin/cargo install --git https://github.com/coral-xyz/anchor --tag v${versions.anchor} anchor-cli --locked`]);
    const snapshot = await sandbox.snapshot();
    return snapshot.snapshotId;
  } finally {
    await sandbox.stop();
  }
}

const [webEvm, solana] = await Promise.all([createWebEvm(), createSolana()]);
console.log(JSON.stringify({ WEB_EVM_SANDBOX_SNAPSHOT_ID: webEvm, SOLANA_SANDBOX_SNAPSHOT_ID: solana }, null, 2));
