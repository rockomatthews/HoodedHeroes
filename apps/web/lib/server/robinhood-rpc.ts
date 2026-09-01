import "server-only";

import { createPublicClient, http } from "viem";

const ROBINHOOD_MAINNET_CHAIN_ID = 4663;
const MAX_BLOCK_AGE_SECONDS = 10 * 60;

export async function preflightRobinhoodRpc() {
  const rpcUrl = process.env.RH_RPC_URL;
  if (!rpcUrl) return { ready: false, configured: false, reason: "RH_RPC_URL is not configured" } as const;
  const startedAt = Date.now();
  try {
    const client = createPublicClient({ transport: http(rpcUrl, { retryCount: 1, timeout: 8_000 }) });
    const [chainId, block] = await Promise.all([client.getChainId(), client.getBlock({ blockTag: "latest" })]);
    const checkedAt = Math.floor(Date.now() / 1_000);
    const blockAgeSeconds = Math.max(0, checkedAt - Number(block.timestamp));
    const chainMatches = chainId === ROBINHOOD_MAINNET_CHAIN_ID;
    const blockIsFresh = blockAgeSeconds <= MAX_BLOCK_AGE_SECONDS;
    return {
      ready: chainMatches && blockIsFresh,
      configured: true,
      chainId,
      expectedChainId: ROBINHOOD_MAINNET_CHAIN_ID,
      chainMatches,
      blockNumber: block.number.toString(),
      blockTimestamp: Number(block.timestamp),
      blockAgeSeconds,
      blockIsFresh,
      latencyMs: Date.now() - startedAt,
    } as const;
  } catch {
    return { ready: false, configured: true, reason: "Robinhood Chain RPC readback failed", latencyMs: Date.now() - startedAt } as const;
  }
}
