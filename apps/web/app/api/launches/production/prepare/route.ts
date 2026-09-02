import { createPublicClient, encodeFunctionData, getAddress, http, isAddress, keccak256, stringToHex, type Address, type Hex } from "viem";
import { z } from "zod";
import { canonicalJson, validateLaunchManifest, type LaunchManifestV1 } from "@hooded/shared";
import { assertSameOrigin, publicError, requireDatabaseRateLimit, requireIdempotencyKey } from "@/lib/server/request-security";
import { getSocietySession } from "@/lib/server/session";
import { immutableMetadataCoreMatches, metadataRevisionMatches, metadataRevisionSignatureValid } from "@/lib/server/manifest-integrity";

export const runtime = "nodejs";
const ZERO = "0x0000000000000000000000000000000000000000" as Address;
const CANONICAL_RH_WETH = "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73" as Address;
const CANONICAL_RH_V4_POOL_MANAGER = "0x8366a39cc670b4001a1121b8f6a443a643e40951" as Address;
const CANONICAL_RH_V4_POSITION_MANAGER = "0x58daec3116aae6d93017baaea7749052e8a04fa7" as Address;
const address = z.string().refine(isAddress, "Invalid address");
const hex32 = z.string().regex(/^0x[a-fA-F0-9]{64}$/);
const signature = z.string().regex(/^0x[a-fA-F0-9]{130}$/);
const requestSchema = z.object({
  manifest: z.custom<LaunchManifestV1>(),
  execution: z.object({
    quoteToken: address,
    securityCouncil: address,
    proceedsRecipient: address,
    operationsRecipient: address,
    rewardsFeeRecipient: address,
    referralRegistry: address,
    eligibilitySigner: address,
    rewardsAllocationRecipient: address,
    treasuryRecipient: address,
    liquidityAdapter: address,
    liquidityAdapterCodeHash: hex32,
    wrappedNativeCodeHash: hex32,
    poolManager: address,
    poolManagerCodeHash: hex32,
    positionManager: address,
    positionManagerCodeHash: hex32,
    approvalNonce: z.string().regex(/^\d+$/),
    approvalDeadline: z.string().datetime(),
    approvalSignature: signature.optional(),
    claimDeadline: z.string().datetime(),
  }),
});

const tokenComponents = [{ name: "name", type: "string" }, { name: "symbol", type: "string" }, { name: "supply", type: "uint256" }, { name: "manifestHash", type: "bytes32" }] as const;
const saleComponents = [
  { name: "saleToken", type: "address" }, { name: "quoteToken", type: "address" }, { name: "saleAllocation", type: "uint256" },
  { name: "pricePerToken", type: "uint256" }, { name: "minimumRaise", type: "uint256" }, { name: "maximumRaise", type: "uint256" },
  { name: "walletCap", type: "uint256" }, { name: "startsAt", type: "uint64" }, { name: "endsAt", type: "uint64" },
  { name: "claimDeadline", type: "uint64" }, { name: "saleFeeBps", type: "uint16" }, { name: "creator", type: "address" },
  { name: "securityCouncil", type: "address" }, { name: "proceedsRecipient", type: "address" }, { name: "liquidityRecipient", type: "address" },
  { name: "operationsRecipient", type: "address" }, { name: "rewardsRecipient", type: "address" }, { name: "referralRegistry", type: "address" },
  { name: "unsoldRecipient", type: "address" }, { name: "eligibilitySigner", type: "address" }, { name: "liquidityShareBps", type: "uint16" },
  { name: "burnUnsold", type: "bool" },
] as const;
const liquidityComponents = [
  { name: "tokenAllocation", type: "uint256" }, { name: "wrappedNative", type: "address" }, { name: "wrappedNativeCodeHash", type: "bytes32" }, { name: "adapter", type: "address" },
  { name: "adapterCodeHash", type: "bytes32" }, { name: "poolManager", type: "address" }, { name: "poolManagerCodeHash", type: "bytes32" },
  { name: "positionManager", type: "address" }, { name: "positionManagerCodeHash", type: "bytes32" },
] as const;
const productionFactoryAbi = [{
  type: "function", name: "createApprovedLaunch", stateMutability: "nonpayable",
  inputs: [
    { name: "tokenConfig", type: "tuple", components: tokenComponents },
    { name: "saleConfig", type: "tuple", components: saleComponents },
    { name: "liquidityConfig", type: "tuple", components: liquidityComponents },
    { name: "otherAllocations", type: "tuple[]", components: [{ name: "recipient", type: "address" }, { name: "amount", type: "uint256" }] },
    { name: "vestedAllocations", type: "tuple[]", components: [{ name: "beneficiary", type: "address" }, { name: "amount", type: "uint256" }, { name: "duration", type: "uint64" }] },
    { name: "approvalNonce", type: "uint256" }, { name: "approvalDeadline", type: "uint256" }, { name: "approvalSignature", type: "bytes" },
  ],
  outputs: [{ name: "tokenAddress", type: "address" }, { name: "fairLaunchAddress", type: "address" }],
}, {
  type: "function", name: "approvalSigner", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }],
}, {
  type: "function", name: "liquidityDeployer", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }],
}, {
  type: "function", name: "hashLaunchConfiguration", stateMutability: "pure",
  inputs: [
    { name: "tokenConfig", type: "tuple", components: tokenComponents },
    { name: "saleConfig", type: "tuple", components: saleComponents },
    { name: "liquidityConfig", type: "tuple", components: liquidityComponents },
    { name: "otherAllocations", type: "tuple[]", components: [{ name: "recipient", type: "address" }, { name: "amount", type: "uint256" }] },
    { name: "vestedAllocations", type: "tuple[]", components: [{ name: "beneficiary", type: "address" }, { name: "amount", type: "uint256" }, { name: "duration", type: "uint64" }] },
  ],
  outputs: [{ name: "", type: "bytes32" }],
}] as const;
const boundAdapterAbi = [{
  type: "function", name: "authorizedFactory", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }],
}, {
  type: "function", name: "coordinatorDeployer", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }],
}, {
  type: "function", name: "poolManager", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }],
}, {
  type: "function", name: "positionManager", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }],
}] as const;

function exactAllocation(supply: bigint, bps: number) {
  const numerator = supply * BigInt(bps);
  if (numerator % 10_000n !== 0n) throw new Response("Supply cannot be divided exactly across allocations", { status: 422 });
  return numerator / 10_000n;
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const idempotencyKey = requireIdempotencyKey(request);
    const session = await getSocietySession();
    if (!session || session.access !== "hero") return Response.json({ error: "A Genesis-Hero-gated session is required" }, { status: 403 });
    await requireDatabaseRateLimit("production-transaction-prepare", session.wallet, 10, 3_600);
    if (process.env.ENABLE_PRODUCTION_LAUNCH_PREPARE !== "true") return Response.json({ error: "Production launch preparation is disabled" }, { status: 403 });
    const { manifest, execution } = requestSchema.parse(await request.json());
    const validation = validateLaunchManifest(manifest);
    if (!validation.ready || !metadataRevisionMatches(manifest) || !immutableMetadataCoreMatches(manifest.metadata) || !await metadataRevisionSignatureValid(manifest)) return Response.json({ error: "Manifest is blocked or its metadata evidence is invalid", validation }, { status: 422 });
    if (manifest.metadata.chain !== "robinhood" || manifest.environment !== "mainnet" || manifest.launchClass !== "production" || manifest.lifecycle !== "public-eligible") {
      return Response.json({ error: "Only public-eligible Robinhood Chain production manifests may be prepared" }, { status: 403 });
    }
    if (manifest.metadata.creatorWallet.toLowerCase() !== session.wallet.toLowerCase()) return Response.json({ error: "Creator wallet mismatch" }, { status: 403 });
    const rpcUrl = process.env.RH_RPC_URL;
    const factoryRaw = process.env.RH_PRODUCTION_LAUNCH_FACTORY_ADDRESS;
    const factoryHash = process.env.RH_PRODUCTION_LAUNCH_FACTORY_CODE_HASH?.toLowerCase() as Hex | undefined;
    const rewardVaultRaw = process.env.RH_HERO_REWARD_VAULT_ADDRESS;
    const rewardVaultHash = process.env.RH_HERO_REWARD_VAULT_CODE_HASH?.toLowerCase() as Hex | undefined;
    const timelockRaw = process.env.RH_DAO_TIMELOCK_ADDRESS;
    const timelockHash = process.env.RH_DAO_TIMELOCK_CODE_HASH?.toLowerCase() as Hex | undefined;
    const approvalSignerRaw = process.env.RH_LAUNCH_APPROVAL_SIGNER;
    if (!rpcUrl || !factoryRaw || !factoryHash || !rewardVaultRaw || !rewardVaultHash || !timelockRaw || !timelockHash || !approvalSignerRaw || !isAddress(factoryRaw) || !isAddress(rewardVaultRaw) || !isAddress(timelockRaw) || !isAddress(approvalSignerRaw)) {
      return Response.json({ error: "Verified Robinhood Chain production contracts are not configured" }, { status: 503 });
    }
    const factory = getAddress(factoryRaw);
    const rewardVault = getAddress(rewardVaultRaw);
    const timelock = getAddress(timelockRaw);
    if (getAddress(execution.rewardsFeeRecipient) !== rewardVault) return Response.json({ error: "Hero reward fee recipient mismatch" }, { status: 422 });
    if (getAddress(execution.rewardsAllocationRecipient) !== rewardVault) return Response.json({ error: "Hero reward allocation recipient mismatch" }, { status: 422 });
    if (getAddress(execution.proceedsRecipient) !== timelock || getAddress(execution.treasuryRecipient) !== timelock) {
      return Response.json({ error: "Sale proceeds and treasury allocation must use the configured DAO timelock" }, { status: 422 });
    }
    if (getAddress(execution.quoteToken) !== ZERO) return Response.json({ error: "HOODED v1 uses native ETH quote" }, { status: 422 });
    if (getAddress(execution.poolManager) !== CANONICAL_RH_V4_POOL_MANAGER || getAddress(execution.positionManager) !== CANONICAL_RH_V4_POSITION_MANAGER) {
      return Response.json({ error: "Canonical Robinhood Chain Uniswap v4 manager mismatch" }, { status: 422 });
    }
    const client = createPublicClient({ transport: http(rpcUrl) });
    const adapterAddress = getAddress(execution.liquidityAdapter);
    const [factoryCode, rewardCode, timelockCode, wethCode, adapterCode, poolManagerCode, managerCode, onchainApprovalSigner, factoryLiquidityDeployer, adapterFactory, adapterCoordinatorDeployer, adapterPoolManager, adapterPositionManager] = await Promise.all([
      client.getCode({ address: factory }), client.getCode({ address: rewardVault }),
      client.getCode({ address: timelock }),
      client.getCode({ address: CANONICAL_RH_WETH }), client.getCode({ address: adapterAddress }), client.getCode({ address: CANONICAL_RH_V4_POOL_MANAGER }),
      client.getCode({ address: CANONICAL_RH_V4_POSITION_MANAGER }),
      client.readContract({ address: factory, abi: productionFactoryAbi, functionName: "approvalSigner" }),
      client.readContract({ address: factory, abi: productionFactoryAbi, functionName: "liquidityDeployer" }),
      client.readContract({ address: adapterAddress, abi: boundAdapterAbi, functionName: "authorizedFactory" }),
      client.readContract({ address: adapterAddress, abi: boundAdapterAbi, functionName: "coordinatorDeployer" }),
      client.readContract({ address: adapterAddress, abi: boundAdapterAbi, functionName: "poolManager" }),
      client.readContract({ address: adapterAddress, abi: boundAdapterAbi, functionName: "positionManager" }),
    ]);
    if (!factoryCode || keccak256(factoryCode).toLowerCase() !== factoryHash) return Response.json({ error: "Production factory bytecode mismatch" }, { status: 409 });
    if (!rewardCode || keccak256(rewardCode).toLowerCase() !== rewardVaultHash) return Response.json({ error: "Reward vault bytecode mismatch" }, { status: 409 });
    if (!timelockCode || keccak256(timelockCode).toLowerCase() !== timelockHash) return Response.json({ error: "DAO timelock bytecode mismatch" }, { status: 409 });
    if (!wethCode || keccak256(wethCode).toLowerCase() !== execution.wrappedNativeCodeHash.toLowerCase()) return Response.json({ error: "WETH bytecode mismatch" }, { status: 409 });
    if (!adapterCode || keccak256(adapterCode).toLowerCase() !== execution.liquidityAdapterCodeHash.toLowerCase()) return Response.json({ error: "Liquidity adapter bytecode mismatch" }, { status: 409 });
    if (!poolManagerCode || keccak256(poolManagerCode).toLowerCase() !== execution.poolManagerCodeHash.toLowerCase()) return Response.json({ error: "Pool manager bytecode mismatch" }, { status: 409 });
    if (!managerCode || keccak256(managerCode).toLowerCase() !== execution.positionManagerCodeHash.toLowerCase()) return Response.json({ error: "Position manager bytecode mismatch" }, { status: 409 });
    if (getAddress(onchainApprovalSigner) !== getAddress(approvalSignerRaw)) return Response.json({ error: "Factory approval signer mismatch" }, { status: 409 });
    if (getAddress(adapterFactory) !== factory) return Response.json({ error: "Liquidity adapter is not bound to the configured production factory" }, { status: 409 });
    if (getAddress(adapterCoordinatorDeployer) !== getAddress(factoryLiquidityDeployer)) return Response.json({ error: "Liquidity adapter coordinator deployer binding mismatch" }, { status: 409 });
    if (getAddress(adapterPoolManager) !== CANONICAL_RH_V4_POOL_MANAGER || getAddress(adapterPositionManager) !== CANONICAL_RH_V4_POSITION_MANAGER) {
      return Response.json({ error: "Liquidity adapter manager readback mismatch" }, { status: 409 });
    }

    const supply = BigInt(manifest.metadata.exactSupply);
    const manifestHash = keccak256(stringToHex(canonicalJson(manifest)));
    const tokenConfig = { name: manifest.metadata.name, symbol: manifest.metadata.symbol, supply, manifestHash };
    const saleConfig = {
      saleToken: ZERO, quoteToken: ZERO, saleAllocation: exactAllocation(supply, manifest.sale.saleAllocationBps),
      pricePerToken: BigInt(manifest.sale.pricePerToken), minimumRaise: BigInt(manifest.sale.minimumRaise), maximumRaise: BigInt(manifest.sale.maximumRaise),
      walletCap: BigInt(manifest.sale.maximumContributionPerWallet), startsAt: BigInt(Math.floor(Date.parse(manifest.sale.startsAt) / 1_000)),
      endsAt: BigInt(Math.floor(Date.parse(manifest.sale.endsAt) / 1_000)), claimDeadline: BigInt(Math.floor(Date.parse(execution.claimDeadline) / 1_000)),
      saleFeeBps: manifest.fees.saleFeeBps, creator: ZERO, securityCouncil: getAddress(execution.securityCouncil), proceedsRecipient: getAddress(execution.proceedsRecipient),
      liquidityRecipient: ZERO, operationsRecipient: getAddress(execution.operationsRecipient), rewardsRecipient: rewardVault,
      referralRegistry: getAddress(execution.referralRegistry), unsoldRecipient: ZERO, eligibilitySigner: getAddress(execution.eligibilitySigner),
      liquidityShareBps: manifest.sale.liquidityQuoteShareBps, burnUnsold: true,
    };
    const liquidityConfig = {
      tokenAllocation: exactAllocation(supply, manifest.sale.liquidityAllocationBps), wrappedNative: CANONICAL_RH_WETH, wrappedNativeCodeHash: execution.wrappedNativeCodeHash as Hex,
      adapter: getAddress(execution.liquidityAdapter), adapterCodeHash: execution.liquidityAdapterCodeHash as Hex,
      poolManager: CANONICAL_RH_V4_POOL_MANAGER, poolManagerCodeHash: execution.poolManagerCodeHash as Hex,
      positionManager: CANONICAL_RH_V4_POSITION_MANAGER, positionManagerCodeHash: execution.positionManagerCodeHash as Hex,
    };
    const otherAllocations = [
      { recipient: getAddress(execution.rewardsAllocationRecipient), amount: exactAllocation(supply, manifest.sale.rewardsAllocationBps) },
      { recipient: getAddress(execution.treasuryRecipient), amount: exactAllocation(supply, manifest.sale.treasuryAllocationBps) },
    ];
    const vestedAllocations = [
      { beneficiary: timelock, amount: exactAllocation(supply, manifest.sale.creatorAllocationBps), duration: 730n * 24n * 60n * 60n },
    ];
    const configHash = await client.readContract({
      address: factory, abi: productionFactoryAbi, functionName: "hashLaunchConfiguration",
      args: [tokenConfig, saleConfig, liquidityConfig, otherAllocations, vestedAllocations],
    });
    const approvalDeadline = BigInt(Math.floor(Date.parse(execution.approvalDeadline) / 1_000));
    if (!execution.approvalSignature) {
      return Response.json({
        prepared: false,
        approvalRequired: true,
        typedData: {
          domain: { name: "HOODED Launch Approval", version: "1", chainId: 4663, verifyingContract: factory },
          primaryType: "LaunchApproval",
          types: {
            LaunchApproval: [
              { name: "creator", type: "address" }, { name: "manifestHash", type: "bytes32" },
              { name: "configHash", type: "bytes32" }, { name: "nonce", type: "uint256" },
              { name: "deadline", type: "uint256" },
            ],
          },
          message: { creator: session.wallet, manifestHash, configHash, nonce: execution.approvalNonce, deadline: approvalDeadline.toString() },
        },
        idempotencyKey,
        warning: "Have the configured review Safe sign this exact EIP-712 payload, then repeat the request with approvalSignature.",
        validation,
      });
    }
    const args = [tokenConfig, saleConfig, liquidityConfig, otherAllocations, vestedAllocations, BigInt(execution.approvalNonce), approvalDeadline, execution.approvalSignature as Hex] as const;
    const data = encodeFunctionData({ abi: productionFactoryAbi, functionName: "createApprovedLaunch", args });
    const simulation = await client.simulateContract({ account: session.wallet as Address, address: factory, abi: productionFactoryAbi, functionName: "createApprovedLaunch", args });
    const gas = await client.estimateGas({ account: session.wallet as Address, to: factory, data });
    return Response.json({
      prepared: true,
      unsigned: { chainId: 4663, from: session.wallet, to: factory, data, value: "0", gas: gas.toString() },
      receipt: { manifestHash, configHash, predictedToken: simulation.result[0], predictedSale: simulation.result[1], factoryCodeHash: factoryHash },
      idempotencyKey,
      warning: "Unsigned only. HOODED never broadcasts this transaction or stores a private key.",
      validation,
    });
  } catch (error) {
    return publicError(error);
  }
}
