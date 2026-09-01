import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

function localValue(name) {
  if (!existsSync(".env")) return undefined;
  const line = readFileSync(".env", "utf8").split(/\r?\n/).find((item) => item.startsWith(`${name}=`));
  return line?.slice(line.indexOf("=") + 1).trim().replace(/^(['"])(.*)\1$/, "$2");
}
function required(name, pattern) {
  const value = process.env[name] || localValue(name);
  if (!value || (pattern && !pattern.test(value))) throw new Error(`${name} is missing or invalid in .env`);
  return value;
}
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", ...options });
  if (result.error || result.status !== 0) throw result.error ?? new Error(result.stderr.trim());
  return result.stdout.trim();
}

const rpcUrl = required("RH_RPC_URL");
const deployer = required("RH_HERO_DEPLOYER_ADDRESS", /^0x[a-fA-F0-9]{40}$/);
const token = required("HOODED_TOKEN_ADDRESS", /^0x[a-fA-F0-9]{40}$/);
const rewards = required("RH_HERO_REWARD_VAULT_ADDRESS", /^0x[a-fA-F0-9]{40}$/);
const timelock = required("RH_DAO_TIMELOCK_ADDRESS", /^0x[a-fA-F0-9]{40}$/);
const founder = required("RH_FOUNDER_WALLET_ADDRESS", /^0x[a-fA-F0-9]{40}$/);
const metadataRoot = required("HERO_METADATA_ROOT", /^0x[a-fA-F0-9]{64}$/);
const metadataBaseUri = required("HERO_METADATA_BASE_URI", /^ipfs:\/\//);
const publicMintStartsAt = required("HERO_PUBLIC_MINT_START", /^\d+$/);
let id = 0;
async function rpc(method, params = []) {
  const response = await fetch(rpcUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }) });
  const payload = await response.json();
  if (!response.ok || payload.error) throw new Error(payload.error?.message ?? `RPC ${response.status}`);
  return payload.result;
}

run("forge", ["build", "--force"], { cwd: "packages/contracts" });
const bytecode = run("forge", ["inspect", "HoodedGenesis", "bytecode"], { cwd: "packages/contracts" });
const runtime = run("forge", ["inspect", "HoodedGenesis", "deployedBytecode"], { cwd: "packages/contracts" });
const constructorArgs = run("cast", ["abi-encode", "constructor(address,address,address,address,uint64,bytes32,string)", token, rewards, timelock, founder, publicMintStartsAt, metadataRoot, metadataBaseUri]);
const initCode = `${bytecode}${constructorArgs.slice(2)}`;
const [chainHex, nonceHex, gasPriceHex, balanceHex, gasHex] = await Promise.all([
  rpc("eth_chainId"), rpc("eth_getTransactionCount", [deployer, "pending"]), rpc("eth_gasPrice"), rpc("eth_getBalance", [deployer, "latest"]),
  rpc("eth_estimateGas", [{ from: deployer, data: initCode }]),
]);
const nonce = BigInt(nonceHex);
const gas = BigInt(gasHex);
const gasPrice = BigInt(gasPriceHex);
const predicted = run("cast", ["compute-address", "--nonce", nonce.toString(), deployer]).match(/0x[a-fA-F0-9]{40}/)?.[0];
console.log(JSON.stringify({
  schema: "hooded-hero-genesis-plan/v1", chainId: Number.parseInt(chainHex, 16), deployer, predictedCollection: predicted,
  founder, founderTokenIds: [1, 10], exactSupply: 3000, initialMinted: 10, publicCapacity: 2990,
  metadataRoot, metadataBaseUri, publicMintStartsAt, estimatedGas: gas.toString(), gasPriceWei: gasPrice.toString(),
  estimatedMaximumCostWei: (gas * gasPrice).toString(), deployerBalanceWei: BigInt(balanceHex).toString(), funded: BigInt(balanceHex) >= gas * gasPrice,
  creationCodeKeccak256: run("cast", ["keccak", bytecode]), runtimeCodeKeccak256: run("cast", ["keccak", runtime]),
  initCodeSha256: createHash("sha256").update(initCode).digest("hex"), broadcasts: false, requiresExplicitBroadcastApproval: true,
}, null, 2));
