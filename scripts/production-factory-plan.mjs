import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

function localValue(name) {
  if (!existsSync(".env")) return undefined;
  const line = readFileSync(".env", "utf8").split(/\r?\n/).find((item) => item.startsWith(`${name}=`));
  return line?.slice(line.indexOf("=") + 1).trim().replace(/^(['"])(.*)\1$/, "$2");
}
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr.trim() || `${command} failed`);
  return result.stdout.trim();
}
const rpcUrl = process.env.RH_RPC_URL || localValue("RH_RPC_URL");
const signer = process.env.RH_LAUNCH_APPROVAL_SIGNER || localValue("RH_LAUNCH_APPROVAL_SIGNER");
const deployer = process.env.RH_FACTORY_DEPLOYER_ADDRESS || localValue("RH_FACTORY_DEPLOYER_ADDRESS") || localValue("LAUNCH_CANARY_OWNER_ADDRESS");
if (!rpcUrl || !/^0x[a-fA-F0-9]{40}$/.test(signer ?? "") || !/^0x[a-fA-F0-9]{40}$/.test(deployer ?? "")) throw new Error("RH_RPC_URL, RH_LAUNCH_APPROVAL_SIGNER, and RH_FACTORY_DEPLOYER_ADDRESS are required in .env");
let id = 0;
async function rpc(method, params = []) {
  const response = await fetch(rpcUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }) });
  const payload = await response.json();
  if (!response.ok || payload.error) throw new Error(payload.error?.message ?? `RPC ${response.status}`);
  return payload.result;
}
run("forge", ["build", "--force"], { cwd: "packages/contracts" });
const creationCode = run("forge", ["inspect", "ProductionLaunchFactory", "bytecode"], { cwd: "packages/contracts" });
const runtimeCode = run("forge", ["inspect", "ProductionLaunchFactory", "deployedBytecode"], { cwd: "packages/contracts" });
const constructorArgs = run("cast", ["abi-encode", "constructor(address)", signer]);
const initCode = `${creationCode}${constructorArgs.slice(2)}`;
const [chainIdHex, nonceHex, gasPriceHex, balanceHex, gasHex] = await Promise.all([
  rpc("eth_chainId"), rpc("eth_getTransactionCount", [deployer, "pending"]), rpc("eth_gasPrice"), rpc("eth_getBalance", [deployer, "latest"]), rpc("eth_estimateGas", [{ from: deployer, data: initCode }]),
]);
const nonce = BigInt(nonceHex);
const gas = BigInt(gasHex);
const gasPrice = BigInt(gasPriceHex);
const cost = gas * gasPrice;
const predicted = run("cast", ["compute-address", "--nonce", nonce.toString(), deployer]).match(/0x[a-fA-F0-9]{40}/)?.[0];
console.log(JSON.stringify({
  schema: "hooded-production-factory-plan/v1", chainId: Number.parseInt(chainIdHex, 16), approvalSigner: signer,
  deployer, nonce: nonce.toString(), predictedFactory: predicted, estimatedGas: gas.toString(), gasPriceWei: gasPrice.toString(),
  estimatedMaximumCostWei: cost.toString(), deployerBalanceWei: BigInt(balanceHex).toString(), funded: BigInt(balanceHex) >= cost,
  creationCodeKeccak256: run("cast", ["keccak", creationCode]), runtimeCodeKeccak256: run("cast", ["keccak", runtimeCode]),
  initCodeSha256: createHash("sha256").update(initCode).digest("hex"), broadcasts: false, requiresExplicitBroadcastApproval: true,
}, null, 2));
