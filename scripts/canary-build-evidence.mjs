import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";

const contractsDirectory = "packages/contracts";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: contractsDirectory, encoding: "utf8", ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr.trim() || `${command} failed`);
  return result.stdout.trim();
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function keccak(hex) {
  return run("cast", ["keccak", hex]);
}

const build = spawnSync("forge", ["build", "--force"], { cwd: contractsDirectory, encoding: "utf8" });
if (build.error) throw build.error;
if (build.status !== 0) {
  console.error(build.stderr);
  process.exit(build.status ?? 1);
}

const names = [
  "LaunchFactory",
  "ProductionLaunchFactory",
  "ProductionTokenDeployer",
  "ProductionSaleDeployer",
  "ProductionLiquidityDeployer",
  "ProductionVestingDeployer",
  "FixedSupplyLaunchToken",
  "ProRataFairLaunch",
  "RobinhoodLiquidityCoordinator",
  "PermanentPositionReceiver",
  "RobinhoodUniswapV4LiquidityAdapter",
  "RobinhoodUniswapV4AdapterDeployer",
  "TokenVestingVault",
  "HeroRoundRewardVault",
  "HoodedGenesis",
];
const components = Object.fromEntries(names.map((name) => {
  const abi = run("forge", ["inspect", name, "abi", "--json"]);
  const bytecode = run("forge", ["inspect", name, "bytecode"]);
  const deployedBytecode = run("forge", ["inspect", name, "deployedBytecode"]);
  return [name, {
    abiSha256: hash(abi),
    creationCodeKeccak256: keccak(bytecode),
    templateRuntimeCodeKeccak256: keccak(deployedBytecode),
    creationBytes: (bytecode.length - 2) / 2,
    templateRuntimeBytes: (deployedBytecode.length - 2) / 2,
  }];
}));

const git = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" });
const status = spawnSync("git", ["status", "--porcelain"], { encoding: "utf8" });
const evidence = {
  schema: "hooded-canary-build-evidence/v1",
  sourceCommit: git.status === 0 ? git.stdout.trim() : null,
  worktreeClean: status.status === 0 && status.stdout.trim().length === 0,
  compiler: { solc: "auto-detect exact source pragmas", optimizer: true, optimizerRuns: 200 },
  factoryVersion: "1.7.0",
  components,
};
const canonical = JSON.stringify(evidence);
const output = { ...evidence, evidenceSha256: hash(canonical) };
console.log(JSON.stringify(output, null, 2));

if (process.argv.includes("--require-clean") && !output.worktreeClean) {
  console.error("Release evidence requires a clean worktree.");
  process.exitCode = 1;
}
