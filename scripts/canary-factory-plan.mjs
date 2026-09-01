import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const EXPECTED_CHAIN_ID = 4663;
const ZERO_ADDRESS = /^0x0{40}$/i;
const ADDRESS = /^0x[a-fA-F0-9]{40}$/;

function localValue(name) {
  if (!existsSync(".env.local")) return undefined;
  const line = readFileSync(".env.local", "utf8").split(/\r?\n/).find((item) => item.startsWith(`${name}=`));
  if (!line) return undefined;
  return line.slice(line.indexOf("=") + 1).trim().replace(/^(['"])(.*)\1$/, "$2");
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr.trim() || `${command} failed`);
  return result.stdout.trim();
}

const rpcUrl = process.env.RH_RPC_URL || localValue("RH_RPC_URL");
const owner = process.env.LAUNCH_CANARY_OWNER_ADDRESS || localValue("LAUNCH_CANARY_OWNER_ADDRESS");
if (!rpcUrl) {
  console.error("Robinhood factory plan failed: RH_RPC_URL is required in .env.local");
  process.exit(1);
}
if (!owner || !ADDRESS.test(owner) || ZERO_ADDRESS.test(owner)) {
  console.error("Robinhood factory plan failed: LAUNCH_CANARY_OWNER_ADDRESS must be one nonzero EVM wallet in .env.local");
  process.exit(1);
}
const endpoint = new URL(rpcUrl);
if (endpoint.protocol !== "https:" && !["127.0.0.1", "localhost"].includes(endpoint.hostname)) {
  console.error("Robinhood factory plan failed: RH_RPC_URL must use HTTPS unless it points to a local fork");
  process.exit(1);
}

let requestId = 0;
async function rpc(method, params = []) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++requestId, method, params }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`RPC returned HTTP ${response.status}`);
    const payload = await response.json();
    if (payload.error) throw new Error(payload.error.message || "RPC error");
    return payload.result;
  } finally {
    clearTimeout(timeout);
  }
}

function quantity(value) {
  return BigInt(value);
}

function formatEth(value) {
  const whole = value / 10n ** 18n;
  const fraction = (value % 10n ** 18n).toString().padStart(18, "0").slice(0, 8).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

try {
  run("forge", ["build", "--force"], { cwd: "packages/contracts" });
  const creationCode = run("forge", ["inspect", "LaunchFactory", "bytecode"], { cwd: "packages/contracts" });
  const runtimeCode = run("forge", ["inspect", "LaunchFactory", "deployedBytecode"], { cwd: "packages/contracts" });
  const constructorArgs = run("cast", ["abi-encode", "constructor(address)", owner]);
  const initCode = `${creationCode}${constructorArgs.slice(2)}`;

  const [chainHex, gasPriceHex, nonceHex, balanceHex, estimatedGasHex] = await Promise.all([
    rpc("eth_chainId"),
    rpc("eth_gasPrice"),
    rpc("eth_getTransactionCount", [owner, "pending"]),
    rpc("eth_getBalance", [owner, "latest"]),
    rpc("eth_estimateGas", [{ data: initCode }]),
  ]);
  const chainId = Number.parseInt(chainHex, 16);
  const gasPrice = quantity(gasPriceHex);
  const nonce = quantity(nonceHex);
  const ownerBalance = quantity(balanceHex);
  const estimatedGas = quantity(estimatedGasHex);
  const estimatedCost = estimatedGas * gasPrice;
  const computed = run("cast", ["compute-address", "--nonce", nonce.toString(), owner]);
  const predictedFactory = computed.match(/0x[a-fA-F0-9]{40}/)?.[0];
  if (!predictedFactory) throw new Error("Could not calculate the factory address");

  const evidence = {
    schema: "hooded-canary-factory-plan/v1",
    chain: "robinhood",
    chainId,
    expectedChainId: EXPECTED_CHAIN_ID,
    owner,
    ownerNonce: nonce.toString(),
    ownerBalanceWei: ownerBalance.toString(),
    predictedFactory,
    estimatedGas: estimatedGas.toString(),
    gasPriceWei: gasPrice.toString(),
    estimatedMaximumCostWei: estimatedCost.toString(),
    estimatedMaximumCostEth: formatEth(estimatedCost),
    ownerAppearsFunded: ownerBalance >= estimatedCost,
    creationCodeKeccak256: run("cast", ["keccak", creationCode]),
    runtimeCodeKeccak256: run("cast", ["keccak", runtimeCode]),
    initCodeSha256: createHash("sha256").update(initCode).digest("hex"),
    broadcasts: false,
    requiresExplicitBroadcastApproval: true,
  };
  console.log(JSON.stringify({ ...evidence, ready: chainId === EXPECTED_CHAIN_ID && evidence.ownerAppearsFunded }, null, 2));
  if (chainId !== EXPECTED_CHAIN_ID) process.exitCode = 1;
} catch (error) {
  console.error(`Robinhood factory plan failed: ${error instanceof Error ? error.message : "unknown error"}`);
  process.exitCode = 1;
}
