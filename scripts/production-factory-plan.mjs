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
const componentDeployers = {
  token: process.env.RH_PRODUCTION_TOKEN_DEPLOYER_ADDRESS || localValue("RH_PRODUCTION_TOKEN_DEPLOYER_ADDRESS"),
  sale: process.env.RH_PRODUCTION_SALE_DEPLOYER_ADDRESS || localValue("RH_PRODUCTION_SALE_DEPLOYER_ADDRESS"),
  liquidity: process.env.RH_PRODUCTION_LIQUIDITY_DEPLOYER_ADDRESS || localValue("RH_PRODUCTION_LIQUIDITY_DEPLOYER_ADDRESS"),
  vesting: process.env.RH_PRODUCTION_VESTING_DEPLOYER_ADDRESS || localValue("RH_PRODUCTION_VESTING_DEPLOYER_ADDRESS"),
};
const isAddress = (value) => /^0x[a-fA-F0-9]{40}$/.test(value ?? "");
if (!rpcUrl || !isAddress(signer) || !isAddress(deployer) || !Object.values(componentDeployers).every(isAddress)) throw new Error("RH_RPC_URL, RH_LAUNCH_APPROVAL_SIGNER, RH_FACTORY_DEPLOYER_ADDRESS, and all four RH_PRODUCTION_*_DEPLOYER_ADDRESS values are required in .env");
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
const componentContracts = {
  token: "ProductionTokenDeployer",
  sale: "ProductionSaleDeployer",
  liquidity: "ProductionLiquidityDeployer",
  vesting: "ProductionVestingDeployer",
};
const componentReadbacks = {};
for (const [kind, address] of Object.entries(componentDeployers)) {
  const liveCode = await rpc("eth_getCode", [address, "latest"]);
  if (liveCode === "0x") throw new Error(`${kind} component deployer has no code`);
  const expectedRuntime = run("forge", ["inspect", componentContracts[kind], "deployedBytecode"], { cwd: "packages/contracts" });
  const liveHash = run("cast", ["keccak", liveCode]);
  const expectedHash = run("cast", ["keccak", expectedRuntime]);
  if (liveHash.toLowerCase() !== expectedHash.toLowerCase()) throw new Error(`${kind} component deployer runtime hash mismatch`);
  componentReadbacks[kind] = { address, runtimeCodeKeccak256: liveHash };
}
const constructorArgs = run("cast", [
  "abi-encode",
  "constructor(address,address,address,address,address)",
  signer,
  componentDeployers.token,
  componentDeployers.sale,
  componentDeployers.liquidity,
  componentDeployers.vesting,
]);
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
  schema: "hooded-production-factory-plan/v1.6", chainId: Number.parseInt(chainIdHex, 16), approvalSigner: signer,
  componentDeployers: componentReadbacks,
  deployer, nonce: nonce.toString(), predictedFactory: predicted, estimatedGas: gas.toString(), gasPriceWei: gasPrice.toString(),
  estimatedMaximumCostWei: cost.toString(), deployerBalanceWei: BigInt(balanceHex).toString(), funded: BigInt(balanceHex) >= cost,
  creationCodeKeccak256: run("cast", ["keccak", creationCode]), runtimeCodeKeccak256: run("cast", ["keccak", runtimeCode]),
  initCodeSha256: createHash("sha256").update(initCode).digest("hex"), broadcasts: false, requiresExplicitBroadcastApproval: true,
}, null, 2));
