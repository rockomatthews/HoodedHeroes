import { createPublicClient, encodeFunctionData, getAddress, http, isAddress, keccak256, stringToHex, type Address, type Hex } from "viem";
import { z } from "zod";
import { canonicalJson, validateLaunchManifest, type LaunchManifestV1 } from "@hooded/shared";
import { canaryModeEnabled, configuredCanaryOwner, isLaunchCanaryOwner } from "@/lib/server/launch-canary";
import { assertSameOrigin, publicError, requireIdempotencyKey } from "@/lib/server/request-security";
import { getSocietySession } from "@/lib/server/session";
import { metadataRevisionMatches } from "@/lib/server/manifest-integrity";

export const runtime = "nodejs";

const address = z.string().refine(isAddress, "Invalid address");
const executionSchema = z.object({
  quoteToken: address,
  securityCouncil: address,
  proceedsRecipient: address,
  operationsRecipient: address,
  rewardsFeeRecipient: address,
  referralRegistry: address,
  unsoldRecipient: address,
  liquidityRecipient: address,
  creatorVestingRecipient: address,
  rewardsAllocationRecipient: address,
  treasuryRecipient: address,
  claimDeadline: z.string().datetime(),
});
const requestSchema = z.object({ manifest: z.custom<LaunchManifestV1>(), execution: executionSchema });

const saleComponents = [
  { name: "saleToken", type: "address" }, { name: "quoteToken", type: "address" }, { name: "saleAllocation", type: "uint256" }, { name: "pricePerToken", type: "uint256" },
  { name: "minimumRaise", type: "uint256" }, { name: "maximumRaise", type: "uint256" }, { name: "walletCap", type: "uint256" },
  { name: "startsAt", type: "uint64" }, { name: "endsAt", type: "uint64" }, { name: "claimDeadline", type: "uint64" },
  { name: "saleFeeBps", type: "uint16" }, { name: "creator", type: "address" }, { name: "securityCouncil", type: "address" },
  { name: "proceedsRecipient", type: "address" }, { name: "operationsRecipient", type: "address" }, { name: "rewardsRecipient", type: "address" },
  { name: "referralRegistry", type: "address" }, { name: "unsoldRecipient", type: "address" },
] as const;
const tokenComponents = [{ name: "name", type: "string" }, { name: "symbol", type: "string" }, { name: "supply", type: "uint256" }, { name: "manifestHash", type: "bytes32" }] as const;
const factoryAbi = [{
  type: "function", name: "createLaunch", stateMutability: "nonpayable",
  inputs: [
    { name: "tokenConfig", type: "tuple", components: tokenComponents },
    { name: "saleConfig", type: "tuple", components: saleComponents },
    { name: "otherAllocations", type: "tuple[]", components: [{ name: "recipient", type: "address" }, { name: "amount", type: "uint256" }] },
  ],
  outputs: [{ name: "tokenAddress", type: "address" }, { name: "fairLaunchAddress", type: "address" }],
}, {
  type: "function", name: "predictAddresses", stateMutability: "view",
  inputs: [{ name: "tokenConfig", type: "tuple", components: tokenComponents }, { name: "saleConfig", type: "tuple", components: saleComponents }],
  outputs: [{ name: "tokenAddress", type: "address" }, { name: "fairLaunchAddress", type: "address" }],
}, {
  type: "function", name: "canaryCreator", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }],
}] as const;

function chainConfiguration(chain: LaunchManifestV1["metadata"]["chain"]) {
  if (chain === "solana") throw new Response("The Solana mainnet program is not implemented", { status: 501 });
  const robinhood = chain === "robinhood";
  const rpcUrl = robinhood ? process.env.RH_RPC_URL : process.env.BASE_RPC_URL;
  const factoryAddress = robinhood ? process.env.RH_LAUNCH_FACTORY_ADDRESS : process.env.BASE_LAUNCH_FACTORY_ADDRESS;
  const expectedCodeHash = robinhood ? process.env.RH_LAUNCH_FACTORY_CODE_HASH : process.env.BASE_LAUNCH_FACTORY_CODE_HASH;
  const rewardVaultAddress = robinhood ? process.env.RH_HERO_REWARD_VAULT_ADDRESS : process.env.BASE_HERO_REWARD_VAULT_ADDRESS;
  const rewardVaultCodeHash = robinhood ? process.env.RH_HERO_REWARD_VAULT_CODE_HASH : process.env.BASE_HERO_REWARD_VAULT_CODE_HASH;
  if (!rpcUrl || !factoryAddress || !expectedCodeHash || !rewardVaultAddress || !rewardVaultCodeHash || !isAddress(factoryAddress) || !isAddress(rewardVaultAddress) || !/^0x[a-fA-F0-9]{64}$/.test(expectedCodeHash) || !/^0x[a-fA-F0-9]{64}$/.test(rewardVaultCodeHash)) {
    throw new Response("The verified mainnet canary factory and reward vault are not configured", { status: 503 });
  }
  return { chainId: robinhood ? 4663 : 8453, rpcUrl, factoryAddress: getAddress(factoryAddress), rewardVaultAddress: getAddress(rewardVaultAddress), expectedCodeHash: expectedCodeHash.toLowerCase() as Hex, rewardVaultCodeHash: rewardVaultCodeHash.toLowerCase() as Hex };
}

function exactAllocation(supply: bigint, bps: number) {
  const numerator = supply * BigInt(bps);
  if (numerator % 10_000n !== 0n) throw new Response("Supply cannot be divided exactly across manifest allocations", { status: 422 });
  return numerator / 10_000n;
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const idempotencyKey = requireIdempotencyKey(request);
    const session = await getSocietySession();
    if (!session || !isLaunchCanaryOwner(session.wallet) || !canaryModeEnabled()) return Response.json({ error: "Owner-only mainnet canary preparation is disabled" }, { status: 403 });
    const owner = configuredCanaryOwner();
    if (!owner) return Response.json({ error: "The canary owner is not configured" }, { status: 503 });
    const { manifest, execution } = requestSchema.parse(await request.json());
    const validation = validateLaunchManifest(manifest);
    if (!validation.ready) return Response.json({ error: "Manifest is blocked", validation }, { status: 422 });
    if (!metadataRevisionMatches(manifest)) return Response.json({ error: "Metadata revision hash does not match the canonical publication record" }, { status: 422 });
    if (manifest.environment !== "mainnet-canary" || manifest.lifecycle !== "canary-ready") return Response.json({ error: "The manifest has not reached the owner-only canary-ready gate", validation }, { status: 403 });
    if (manifest.metadata.creatorWallet.toLowerCase() !== owner.toLowerCase()) return Response.json({ error: "Manifest creator does not match the canary owner" }, { status: 403 });

    const network = chainConfiguration(manifest.metadata.chain);
    if (!isAddress(manifest.fees.rewardsRecipient) || getAddress(manifest.fees.rewardsRecipient) !== network.rewardVaultAddress || getAddress(execution.rewardsFeeRecipient) !== network.rewardVaultAddress) {
      return Response.json({ error: "Reward fees must route to the manifest-bound verified Hero reward vault" }, { status: 422 });
    }
    const client = createPublicClient({ transport: http(network.rpcUrl) });
    const [code, rewardVaultCode] = await Promise.all([client.getCode({ address: network.factoryAddress }), client.getCode({ address: network.rewardVaultAddress })]);
    if (!code || keccak256(code).toLowerCase() !== network.expectedCodeHash) return Response.json({ error: "Factory bytecode does not match the reviewed mainnet canary build" }, { status: 409 });
    if (!rewardVaultCode || keccak256(rewardVaultCode).toLowerCase() !== network.rewardVaultCodeHash) return Response.json({ error: "Hero reward vault bytecode does not match the reviewed build" }, { status: 409 });
    const onchainOwner = await client.readContract({ address: network.factoryAddress, abi: factoryAbi, functionName: "canaryCreator" });
    if (getAddress(onchainOwner) !== owner) return Response.json({ error: "Factory canary owner does not match the signed owner" }, { status: 409 });

    const supply = BigInt(manifest.metadata.exactSupply);
    const manifestHash = keccak256(stringToHex(canonicalJson(manifest)));
    const tokenConfig = { name: manifest.metadata.name, symbol: manifest.metadata.symbol, supply, manifestHash };
    const saleConfig = {
      saleToken: "0x0000000000000000000000000000000000000000" as Address,
      quoteToken: getAddress(execution.quoteToken), saleAllocation: exactAllocation(supply, manifest.sale.saleAllocationBps), pricePerToken: BigInt(manifest.sale.pricePerToken),
      minimumRaise: BigInt(manifest.sale.minimumRaise), maximumRaise: BigInt(manifest.sale.maximumRaise), walletCap: BigInt(manifest.sale.maximumContributionPerWallet),
      startsAt: BigInt(Math.floor(Date.parse(manifest.sale.startsAt) / 1_000)), endsAt: BigInt(Math.floor(Date.parse(manifest.sale.endsAt) / 1_000)), claimDeadline: BigInt(Math.floor(Date.parse(execution.claimDeadline) / 1_000)),
      saleFeeBps: manifest.fees.saleFeeBps, creator: "0x0000000000000000000000000000000000000000" as Address,
      securityCouncil: getAddress(execution.securityCouncil), proceedsRecipient: getAddress(execution.proceedsRecipient), operationsRecipient: getAddress(execution.operationsRecipient),
      rewardsRecipient: network.rewardVaultAddress, referralRegistry: getAddress(execution.referralRegistry), unsoldRecipient: getAddress(execution.unsoldRecipient),
    };
    if (saleConfig.claimDeadline <= saleConfig.endsAt) return Response.json({ error: "Claim deadline must follow the sale window" }, { status: 422 });
    const otherAllocations = [
      { recipient: getAddress(execution.liquidityRecipient), amount: exactAllocation(supply, manifest.sale.liquidityAllocationBps) },
      { recipient: getAddress(execution.creatorVestingRecipient), amount: exactAllocation(supply, manifest.sale.creatorAllocationBps) },
      { recipient: getAddress(execution.rewardsAllocationRecipient), amount: exactAllocation(supply, manifest.sale.rewardsAllocationBps) },
      { recipient: getAddress(execution.treasuryRecipient), amount: exactAllocation(supply, manifest.sale.treasuryAllocationBps) },
    ].filter((item) => item.amount > 0n);
    const args = [tokenConfig, saleConfig, otherAllocations] as const;
    const data = encodeFunctionData({ abi: factoryAbi, functionName: "createLaunch", args });
    const [predictedToken, predictedSale] = await client.readContract({ address: network.factoryAddress, abi: factoryAbi, functionName: "predictAddresses", args: [tokenConfig, saleConfig] });
    await client.call({ account: owner, to: network.factoryAddress, data });
    const gas = await client.estimateGas({ account: owner, to: network.factoryAddress, data });

    return Response.json({
      prepared: true,
      unsigned: { chainId: network.chainId, from: owner, to: network.factoryAddress, data, value: "0", gas: gas.toString() },
      receipt: { manifestHash, factoryCodeHash: network.expectedCodeHash, predictedToken, predictedSale, sealedAtCreation: true, publicActivationTransactionRequired: true },
      idempotencyKey,
      warning: "This is an unsigned mainnet transaction. HOODED never broadcasts it or stores a private key.",
      validation,
    });
  } catch (error) {
    return publicError(error);
  }
}
