import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const contracts = {
  WETH: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73",
  poolManager: "0x8366a39cc670b4001a1121b8f6a443a643e40951",
  positionManager: "0x58daec3116aae6d93017baaea7749052e8a04fa7",
};

function localValue(name) {
  if (!existsSync(".env")) return undefined;
  const line = readFileSync(".env", "utf8").split(/\r?\n/).find((item) => item.startsWith(`${name}=`));
  return line?.slice(line.indexOf("=") + 1).trim().replace(/^(['"])(.*)\1$/, "$2");
}

function keccak(code) {
  const result = spawnSync("cast", ["keccak", code], { encoding: "utf8" });
  if (result.error || result.status !== 0) throw result.error ?? new Error(result.stderr.trim());
  return result.stdout.trim();
}

const rpcUrl = process.env.RH_RPC_URL || localValue("RH_RPC_URL");
if (!rpcUrl) throw new Error("RH_RPC_URL is required in .env");
let id = 0;
async function rpc(method, params = []) {
  const response = await fetch(rpcUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }) });
  const payload = await response.json();
  if (!response.ok || payload.error) throw new Error(payload.error?.message ?? `RPC ${response.status}`);
  return payload.result;
}

const chainId = Number.parseInt(await rpc("eth_chainId"), 16);
if (chainId !== 4663) throw new Error(`Expected Robinhood Chain 4663, received ${chainId}`);
const entries = await Promise.all(Object.entries(contracts).map(async ([name, address]) => {
  const code = await rpc("eth_getCode", [address, "latest"]);
  if (!code || code === "0x") throw new Error(`${name} has no runtime bytecode`);
  return [name, { address, runtimeCodeHash: keccak(code), runtimeBytes: (code.length - 2) / 2 }];
}));
console.log(JSON.stringify({ schema: "hooded-rh-uniswap-readback/v1", chainId, blockNumber: BigInt(await rpc("eth_blockNumber")).toString(), contracts: Object.fromEntries(entries), broadcasts: false }, null, 2));
