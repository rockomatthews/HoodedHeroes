import "server-only";

import { createPublicClient, getAddress, http, isAddress, parseAbi, zeroAddress } from "viem";
import { evaluateSocietyAccess } from "@hooded/shared";

const balanceAbi = parseAbi(["function balanceOf(address owner) view returns (uint256)"]);

export function accessConfigurationReady() {
  const token = process.env.HOODED_TOKEN_ADDRESS;
  const heroes = process.env.GENESIS_HERO_ADDRESS;
  return Boolean(
    process.env.RH_RPC_URL
      && token
      && heroes
      && isAddress(token)
      && isAddress(heroes)
      && getAddress(token) !== zeroAddress
      && getAddress(heroes) !== zeroAddress,
  );
}

export async function readWalletAccess(wallet: `0x${string}`) {
  if (!accessConfigurationReady()) throw new Error("Robinhood Chain access contracts are not configured");
  const client = createPublicClient({ transport: http(process.env.RH_RPC_URL) });
  const address = getAddress(wallet);
  const [hoodedBalance, genesisHeroBalance] = await Promise.all([
    client.readContract({ address: getAddress(process.env.HOODED_TOKEN_ADDRESS as `0x${string}`), abi: balanceAbi, functionName: "balanceOf", args: [address] }),
    client.readContract({ address: getAddress(process.env.GENESIS_HERO_ADDRESS as `0x${string}`), abi: balanceAbi, functionName: "balanceOf", args: [address] }),
  ]);
  return { hoodedBalance, genesisHeroBalance, access: evaluateSocietyAccess({ hoodedBalance, genesisHeroBalance }) };
}
