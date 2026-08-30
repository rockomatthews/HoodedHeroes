import "server-only";

import { createPublicClient, getAddress, http, parseAbi } from "viem";
import { evaluateSocietyAccess } from "@hoodedheroes/shared";

const balanceAbi = parseAbi(["function balanceOf(address owner) view returns (uint256)"]);

export function accessConfigurationReady() {
  return Boolean(process.env.RH_RPC_URL && process.env.HERO_TOKEN_ADDRESS && process.env.GENESIS_HERO_ADDRESS);
}

export async function readWalletAccess(wallet: `0x${string}`) {
  if (!accessConfigurationReady()) throw new Error("Robinhood Chain access contracts are not configured");
  const client = createPublicClient({ transport: http(process.env.RH_RPC_URL) });
  const address = getAddress(wallet);
  const [heroBalance, genesisHeroBalance] = await Promise.all([
    client.readContract({ address: getAddress(process.env.HERO_TOKEN_ADDRESS as `0x${string}`), abi: balanceAbi, functionName: "balanceOf", args: [address] }),
    client.readContract({ address: getAddress(process.env.GENESIS_HERO_ADDRESS as `0x${string}`), abi: balanceAbi, functionName: "balanceOf", args: [address] }),
  ]);
  return { heroBalance, genesisHeroBalance, access: evaluateSocietyAccess({ heroBalance, genesisHeroBalance }) };
}
