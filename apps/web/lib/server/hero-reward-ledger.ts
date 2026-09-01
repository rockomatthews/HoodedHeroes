import "server-only";

import { createPublicClient, getAddress, http, isAddress, keccak256, type Address } from "viem";

const vaultAbi = [
  { type: "function", name: "rewardToken", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
  { type: "function", name: "genesisHeroes", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
  { type: "function", name: "checkpointCount", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "totalFunded", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "claimLiability", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "totalDelivered", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "carry", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "cumulativeRewardPerHero", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
] as const;

const tokenAbi = [
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "string" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint8" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "owner", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
] as const;

const heroesAbi = [
  { type: "function", name: "totalMinted", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint16" }] },
] as const;

export async function readHeroRewardLedger() {
  const rpcUrl = process.env.RH_RPC_URL;
  const configuredAddress = process.env.RH_HERO_REWARD_VAULT_ADDRESS;
  const expectedCodeHash = process.env.RH_HERO_REWARD_VAULT_CODE_HASH;
  if (!rpcUrl || !configuredAddress || !expectedCodeHash || !isAddress(configuredAddress) || !/^0x[a-fA-F0-9]{64}$/.test(expectedCodeHash)) {
    return { schema: "hooded-hero-reward-ledger/v1", status: "not-configured", chainId: 4663 } as const;
  }

  const vaultAddress = getAddress(configuredAddress);
  const client = createPublicClient({ transport: http(rpcUrl, { retryCount: 1, timeout: 8_000 }) });
  try {
    const blockNumber = await client.getBlockNumber();
    const code = await client.getCode({ address: vaultAddress, blockNumber });
    if (!code || keccak256(code).toLowerCase() !== expectedCodeHash.toLowerCase()) {
      return { schema: "hooded-hero-reward-ledger/v1", status: "unavailable", chainId: 4663, vaultAddress } as const;
    }
    const readVault = <TFunctionName extends (typeof vaultAbi)[number]["name"]>(functionName: TFunctionName) =>
      client.readContract({ address: vaultAddress, abi: vaultAbi, functionName, blockNumber });
    const [rewardToken, genesisHeroes, rounds, totalFunded, claimLiability, totalDelivered, carry, rewardPerHero] = await Promise.all([
      readVault("rewardToken"),
      readVault("genesisHeroes"),
      readVault("checkpointCount"),
      readVault("totalFunded"),
      readVault("claimLiability"),
      readVault("totalDelivered"),
      readVault("carry"),
      readVault("cumulativeRewardPerHero"),
    ]);
    const tokenAddress = getAddress(rewardToken as Address);
    const heroAddress = getAddress(genesisHeroes as Address);
    const [symbol, decimals, vaultBalance, eligibleHeroes] = await Promise.all([
      client.readContract({ address: tokenAddress, abi: tokenAbi, functionName: "symbol", blockNumber }),
      client.readContract({ address: tokenAddress, abi: tokenAbi, functionName: "decimals", blockNumber }),
      client.readContract({ address: tokenAddress, abi: tokenAbi, functionName: "balanceOf", args: [vaultAddress], blockNumber }),
      client.readContract({ address: heroAddress, abi: heroesAbi, functionName: "totalMinted", blockNumber }),
    ]);
    const accounted = claimLiability + carry;
    return {
      schema: "hooded-hero-reward-ledger/v1",
      status: "live",
      chainId: 4663,
      blockNumber: blockNumber.toString(),
      vaultAddress,
      rewardAsset: { address: tokenAddress, symbol, decimals },
      eligibleHeroes,
      rounds: rounds.toString(),
      totals: {
        funded: totalFunded.toString(),
        claimable: claimLiability.toString(),
        delivered: totalDelivered.toString(),
        carry: carry.toString(),
        rewardPerHero: rewardPerHero.toString(),
        vaultBalance: vaultBalance.toString(),
        accounted: accounted.toString(),
        surplus: (vaultBalance > accounted ? vaultBalance - accounted : 0n).toString(),
      },
      reconciled: vaultBalance >= accounted,
    } as const;
  } catch {
    return { schema: "hooded-hero-reward-ledger/v1", status: "unavailable", chainId: 4663, vaultAddress } as const;
  }
}
