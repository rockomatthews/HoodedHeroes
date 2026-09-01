import { createPublicClient, encodeFunctionData, getAddress, http, isAddress, keccak256, type Hex } from "viem";
import { z } from "zod";
import { canaryModeEnabled, configuredCanaryOwner, isLaunchCanaryOwner } from "@/lib/server/launch-canary";
import { assertSameOrigin, publicError, requireIdempotencyKey } from "@/lib/server/request-security";
import { getSocietySession } from "@/lib/server/session";

export const runtime = "nodejs";

const requestSchema = z.object({ chain: z.enum(["robinhood", "base"]) });
const saleAbi = [
  { type: "function", name: "activate", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "creator", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
  { type: "function", name: "activated", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "bool" }] },
  { type: "function", name: "startsAt", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint64" }] },
  { type: "function", name: "saleToken", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
] as const;
const tokenAbi = [{ type: "function", name: "manifestHash", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "bytes32" }] }] as const;

function configuration(chain: "robinhood" | "base") {
  const robinhood = chain === "robinhood";
  const rpcUrl = robinhood ? process.env.RH_RPC_URL : process.env.BASE_RPC_URL;
  const saleAddress = robinhood ? process.env.RH_CANARY_SALE_ADDRESS : process.env.BASE_CANARY_SALE_ADDRESS;
  const saleCodeHash = robinhood ? process.env.RH_CANARY_SALE_CODE_HASH : process.env.BASE_CANARY_SALE_CODE_HASH;
  const manifestHash = robinhood ? process.env.RH_CANARY_MANIFEST_HASH : process.env.BASE_CANARY_MANIFEST_HASH;
  if (!rpcUrl || !saleAddress || !isAddress(saleAddress) || !saleCodeHash || !/^0x[a-fA-F0-9]{64}$/.test(saleCodeHash) || !manifestHash || !/^0x[a-fA-F0-9]{64}$/.test(manifestHash)) {
    throw new Response("The reviewed sealed canary sale is not configured for activation", { status: 503 });
  }
  return { chainId: robinhood ? 4663 : 8453, rpcUrl, saleAddress: getAddress(saleAddress), saleCodeHash: saleCodeHash.toLowerCase() as Hex, manifestHash: manifestHash.toLowerCase() as Hex };
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const idempotencyKey = requireIdempotencyKey(request);
    const session = await getSocietySession();
    const owner = configuredCanaryOwner();
    if (!session || !owner || !canaryModeEnabled() || !isLaunchCanaryOwner(session.wallet)) return Response.json({ error: "Owner-only canary activation is disabled" }, { status: 403 });
    const { chain } = requestSchema.parse(await request.json());
    const network = configuration(chain);
    const client = createPublicClient({ transport: http(network.rpcUrl) });
    const code = await client.getCode({ address: network.saleAddress });
    if (!code || keccak256(code).toLowerCase() !== network.saleCodeHash) return Response.json({ error: "Sale bytecode does not match the reviewed sealed canary" }, { status: 409 });
    const [creator, activated, startsAt, saleToken] = await Promise.all([
      client.readContract({ address: network.saleAddress, abi: saleAbi, functionName: "creator" }),
      client.readContract({ address: network.saleAddress, abi: saleAbi, functionName: "activated" }),
      client.readContract({ address: network.saleAddress, abi: saleAbi, functionName: "startsAt" }),
      client.readContract({ address: network.saleAddress, abi: saleAbi, functionName: "saleToken" }),
    ]);
    if (getAddress(creator) !== owner) return Response.json({ error: "Sale creator does not match the signed canary owner" }, { status: 409 });
    if (activated) return Response.json({ error: "The canary sale is already activated" }, { status: 409 });
    if (startsAt <= BigInt(Math.floor(Date.now() / 1_000))) return Response.json({ error: "The activation window has closed" }, { status: 409 });
    const onchainManifestHash = await client.readContract({ address: saleToken, abi: tokenAbi, functionName: "manifestHash" });
    if (onchainManifestHash.toLowerCase() !== network.manifestHash) return Response.json({ error: "Token manifest hash does not match the approved canary" }, { status: 409 });
    const data = encodeFunctionData({ abi: saleAbi, functionName: "activate" });
    await client.call({ account: owner, to: network.saleAddress, data });
    const gas = await client.estimateGas({ account: owner, to: network.saleAddress, data });
    return Response.json({
      prepared: true,
      unsigned: { chainId: network.chainId, from: owner, to: network.saleAddress, data, value: "0", gas: gas.toString() },
      receipt: { token: saleToken, manifestHash: onchainManifestHash, saleCodeHash: network.saleCodeHash, currentlySealed: true },
      idempotencyKey,
      warning: "Activation opens the configured contribution window. HOODED never broadcasts this transaction.",
    });
  } catch (error) {
    return publicError(error);
  }
}
