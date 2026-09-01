import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

function localValue(name) {
  if (!existsSync(".env")) return undefined;
  const line = readFileSync(".env", "utf8").split(/\r?\n/).find((item) => item.startsWith(`${name}=`));
  if (!line) return undefined;
  const value = line.slice(line.indexOf("=") + 1).trim();
  return value.replace(/^(['"])(.*)\1$/, "$2");
}

const rpcUrl = process.env.RH_RPC_URL || localValue("RH_RPC_URL");
if (!rpcUrl) {
  console.error("RH_RPC_URL is not configured. Add it to .env; never commit or paste it into logs.");
  process.exit(1);
}

const parsed = new URL(rpcUrl);
if (parsed.protocol !== "https:" && parsed.hostname !== "127.0.0.1" && parsed.hostname !== "localhost") {
  console.error("RH_RPC_URL must use HTTPS unless it points to a local fork.");
  process.exit(1);
}

let requestId = 0;
async function rpc(method, params = []) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++requestId, method, params }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    if (payload.error) throw new Error(payload.error.message || "RPC error");
    return payload.result;
  } finally {
    clearTimeout(timeout);
  }
}

const startedAt = Date.now();
try {
  const [chainHex, blockHex, block] = await Promise.all([rpc("eth_chainId"), rpc("eth_blockNumber"), rpc("eth_getBlockByNumber", ["latest", false])]);
  const chainId = Number.parseInt(chainHex, 16);
  const blockNumber = BigInt(blockHex);
  const blockTimestamp = Number.parseInt(block.timestamp, 16);
  const blockAgeSeconds = Math.max(0, Math.floor(Date.now() / 1_000) - blockTimestamp);
  const ready = chainId === 4663 && blockAgeSeconds <= 600;
  console.log(JSON.stringify({ ready, chainId, expectedChainId: 4663, blockNumber: blockNumber.toString(), blockTimestamp, blockAgeSeconds, latencyMs: Date.now() - startedAt }, null, 2));
  if (!ready) process.exitCode = 1;
  if (ready && process.argv.includes("--fork")) {
    const result = spawnSync("forge", ["test", "--match-contract", "LaunchFactoryForkTest", "--match-test", "testRobinhoodMainnetForkOwnerCanaryWhenEnabled", "-vv"], {
      cwd: "packages/contracts",
      env: { ...process.env, RH_RPC_URL: rpcUrl, RUN_MAINNET_FORK_TESTS: "true" },
      stdio: "inherit",
    });
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
  }
} catch (error) {
  console.error(`Robinhood Chain RPC preflight failed: ${error instanceof Error ? error.message : "unknown error"}`);
  process.exitCode = 1;
}
