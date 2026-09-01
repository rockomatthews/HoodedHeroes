import "server-only";

import { createPublicClient, decodeEventLog, http, parseAbi, type Address, type Hex, type Log } from "viem";
import { db } from "./database";

const events = parseAbi([
  "event LaunchCreated(address indexed creator,address indexed token,address indexed fairLaunch,address liquidityCoordinator,address positionLock,bytes32 manifestHash)",
  "event CanonicalPoolActivated(bytes32 indexed manifestHash,address indexed token,address indexed quoteToken,bytes32 venueId,bytes32 poolId,uint24 fee,int24 tickSpacing,address hook,uint256 positionId,address positionLock)",
  "event LiquidityFinalized(uint256 indexed positionId,uint256 tokenAmount,uint256 nativeAmount)",
  "event Contributed(address indexed contributor,uint256 amount,address indexed referrer)",
  "event Claimed(address indexed contributor,uint256 tokens,uint256 acceptedQuote,uint256 refundedQuote)",
  "event Refunded(address indexed contributor,uint256 amount)",
  "event QuoteAccrued(address indexed recipient,uint256 amount)",
  "event QuoteWithdrawn(address indexed recipient,uint256 amount)",
  "event Activated(address indexed creator)",
  "event PauseChanged(bool paused)",
  "event Cancelled()",
  "event UnsoldBurned(uint256 amount)",
]);

function jsonSafe(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, jsonSafe(item)]));
  return value;
}

export async function indexRobinhoodLaunches() {
  if (!process.env.RH_RPC_URL) throw new Error("RH_RPC_URL is not configured");
  const sql = db();
  const launches = await sql`select project_id, manifest_hash, sale_address, factory_address from launches where chain = 'robinhood' and (sale_address is not null or factory_address is not null)`;
  if (!launches.length) return { indexed: 0, launches: 0 };
  const projectByAddress = new Map<string, string>();
  const projectByManifest = new Map<string, string>();
  for (const row of launches) {
    if (row.sale_address) projectByAddress.set(String(row.sale_address).toLowerCase(), String(row.project_id));
    if (row.factory_address) projectByAddress.set(String(row.factory_address).toLowerCase(), String(row.project_id));
    projectByManifest.set(String(row.manifest_hash).toLowerCase(), String(row.project_id));
  }
  const positions = await sql`select project_id, coordinator_address from liquidity_positions where project_id in ${sql(launches.map((row) => String(row.project_id)))}`;
  for (const row of positions) projectByAddress.set(String(row.coordinator_address).toLowerCase(), String(row.project_id));
  const client = createPublicClient({ transport: http(process.env.RH_RPC_URL) });
  const latest = await client.getBlockNumber();
  const cursors = await sql`select block_number from indexer_cursors where cursor_key = 'robinhood-launches' limit 1`;
  const configuredStart = BigInt(process.env.RH_INDEXER_START_BLOCK ?? "0");
  const prior = cursors[0] ? BigInt(String(cursors[0].block_number)) : configuredStart;
  const fromBlock = prior + 1n;
  if (fromBlock > latest) return { indexed: 0, launches: launches.length, latest: latest.toString() };
  const toBlock = fromBlock + 1_999n < latest ? fromBlock + 1_999n : latest;
  const hydrateLaunchCreated = async (
    log: Log<bigint, number, false>,
    args: Record<string, string>,
    projectId: string,
  ) => {
    const positionManager = await client.readContract({
      address: args.liquidityCoordinator as Address,
      abi: parseAbi(["function positionManager() view returns (address)"]),
      functionName: "positionManager",
    });
    await sql.begin(async (tx) => {
      await tx`update launches set token_address = ${String(args.token).toLowerCase()}, sale_address = ${String(args.fairLaunch).toLowerCase()}, factory_address = ${log.address.toLowerCase()}, updated_at = now() where project_id = ${projectId}`;
      await tx`insert into liquidity_positions (project_id, coordinator_address, lock_address, position_manager) values (${projectId}, ${String(args.liquidityCoordinator).toLowerCase()}, ${String(args.positionLock).toLowerCase()}, ${String(positionManager).toLowerCase()}) on conflict (project_id) do update set coordinator_address = excluded.coordinator_address, lock_address = excluded.lock_address, position_manager = excluded.position_manager`;
    });
    projectByAddress.set(String(args.fairLaunch).toLowerCase(), projectId);
    projectByAddress.set(String(args.liquidityCoordinator).toLowerCase(), projectId);
  };

  // Factories emit the new sale and coordinator addresses. Hydrate them before the
  // main range query so same-transaction sale/coordinator events cannot be skipped.
  const factoryAddresses = [...new Set(launches.flatMap((row) => row.factory_address ? [String(row.factory_address).toLowerCase()] : []))] as Address[];
  if (factoryAddresses.length) {
    const creationLogs = await client.getLogs({ address: factoryAddresses, fromBlock, toBlock });
    for (const log of creationLogs as Log<bigint, number, false>[]) {
      try {
        const decoded = decodeEventLog({ abi: events, data: log.data as Hex, topics: log.topics as [Hex, ...Hex[]], strict: false });
        if (decoded.eventName !== "LaunchCreated") continue;
        const args = jsonSafe(decoded.args) as Record<string, string>;
        const projectId = projectByManifest.get(String(args.manifestHash).toLowerCase());
        if (projectId) await hydrateLaunchCreated(log, args, projectId);
      } catch {
        continue;
      }
    }
  }
  const addresses = [...new Set(projectByAddress.keys())] as Address[];
  const logs = await client.getLogs({ address: addresses, fromBlock, toBlock });
  let indexed = 0;
  for (const log of logs as Log<bigint, number, false>[]) {
    let decoded: ReturnType<typeof decodeEventLog>;
    try {
      decoded = decodeEventLog({ abi: events, data: log.data as Hex, topics: log.topics as [Hex, ...Hex[]], strict: false });
    } catch {
      continue;
    }
    const args = jsonSafe(decoded.args) as Record<string, string>;
    const manifestHash = args.manifestHash?.toLowerCase();
    const projectId = (manifestHash ? projectByManifest.get(manifestHash) : undefined) || projectByAddress.get(log.address.toLowerCase());
    if (!projectId || log.logIndex === null || !log.transactionHash) continue;
    await sql`insert into launch_events (chain_id, transaction_hash, log_index, project_id, block_number, event_name, payload) values (4663, ${log.transactionHash}, ${log.logIndex}, ${projectId}, ${String(log.blockNumber)}, ${decoded.eventName}, ${sql.json(args)}) on conflict do nothing`;
    if (decoded.eventName === "LaunchCreated") {
      await hydrateLaunchCreated(log, args, projectId);
    } else if (decoded.eventName === "CanonicalPoolActivated") {
      await sql`update liquidity_positions set token_address = ${String(args.token).toLowerCase()}, quote_token_address = ${String(args.quoteToken).toLowerCase()}, venue_identifier = ${args.venueId}, pool_id = ${args.poolId}, fee = ${Number(args.fee)}, tick_spacing = ${Number(args.tickSpacing)}, hook_address = ${String(args.hook).toLowerCase()}, position_id = ${args.positionId}, lock_address = ${String(args.positionLock).toLowerCase()}, finalization_transaction_hash = ${log.transactionHash}, permanently_locked = true, verified_at = now() where project_id = ${projectId} and coordinator_address = ${log.address.toLowerCase()}`;
    } else if (decoded.eventName === "LiquidityFinalized") {
      await sql`update liquidity_positions set position_id = ${args.positionId}, token_amount = ${args.tokenAmount}, quote_amount = ${args.nativeAmount} where project_id = ${projectId} and coordinator_address = ${log.address.toLowerCase()}`;
    } else if (decoded.eventName === "Contributed") {
      await sql`insert into launch_contributions (project_id, wallet_address, contributed) values (${projectId}, ${String(args.contributor).toLowerCase()}, ${args.amount}) on conflict (project_id, wallet_address) do update set contributed = launch_contributions.contributed + excluded.contributed, updated_at = now()`;
    } else if (decoded.eventName === "Claimed") {
      await sql`insert into launch_contributions (project_id, wallet_address, accepted, refunded, token_allocation, settled) values (${projectId}, ${String(args.contributor).toLowerCase()}, ${args.acceptedQuote}, ${args.refundedQuote}, ${args.tokens}, true) on conflict (project_id, wallet_address) do update set accepted = excluded.accepted, refunded = excluded.refunded, token_allocation = excluded.token_allocation, settled = true, updated_at = now()`;
    } else if (decoded.eventName === "Refunded") {
      await sql`insert into launch_contributions (project_id, wallet_address, refunded, settled) values (${projectId}, ${String(args.contributor).toLowerCase()}, ${args.amount}, true) on conflict (project_id, wallet_address) do update set refunded = excluded.refunded, settled = true, updated_at = now()`;
    }
    indexed += 1;
  }
  const block = await client.getBlock({ blockNumber: toBlock });
  await sql`insert into indexer_cursors (cursor_key, block_number, block_hash) values ('robinhood-launches', ${toBlock.toString()}, ${block.hash}) on conflict (cursor_key) do update set block_number = excluded.block_number, block_hash = excluded.block_hash, updated_at = now()`;
  return { indexed, launches: addresses.length, fromBlock: fromBlock.toString(), toBlock: toBlock.toString(), latest: latest.toString() };
}
