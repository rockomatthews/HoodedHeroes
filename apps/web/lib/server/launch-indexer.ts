import "server-only";

import { createPublicClient, decodeEventLog, http, parseAbi, type Address, type Hex, type Log } from "viem";
import { db } from "./database";

const events = parseAbi([
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
  const launches = await sql`select project_id, sale_address from launches where chain = 'robinhood' and sale_address is not null`;
  if (!launches.length) return { indexed: 0, launches: 0 };
  const projectBySale = new Map(launches.map((row) => [String(row.sale_address).toLowerCase(), String(row.project_id)]));
  const addresses = [...projectBySale.keys()] as Address[];
  const client = createPublicClient({ transport: http(process.env.RH_RPC_URL) });
  const latest = await client.getBlockNumber();
  const cursors = await sql`select block_number from indexer_cursors where cursor_key = 'robinhood-launches' limit 1`;
  const configuredStart = BigInt(process.env.RH_INDEXER_START_BLOCK ?? "0");
  const prior = cursors[0] ? BigInt(String(cursors[0].block_number)) : configuredStart;
  const fromBlock = prior + 1n;
  if (fromBlock > latest) return { indexed: 0, launches: addresses.length, latest: latest.toString() };
  const toBlock = fromBlock + 1_999n < latest ? fromBlock + 1_999n : latest;
  const logs = await client.getLogs({ address: addresses, fromBlock, toBlock });
  let indexed = 0;
  for (const log of logs as Log<bigint, number, false>[]) {
    let decoded: ReturnType<typeof decodeEventLog>;
    try {
      decoded = decodeEventLog({ abi: events, data: log.data as Hex, topics: log.topics as [Hex, ...Hex[]], strict: false });
    } catch {
      continue;
    }
    const projectId = projectBySale.get(log.address.toLowerCase());
    if (!projectId || log.logIndex === null || !log.transactionHash) continue;
    const args = jsonSafe(decoded.args) as Record<string, string>;
    await sql`insert into launch_events (chain_id, transaction_hash, log_index, project_id, block_number, event_name, payload) values (4663, ${log.transactionHash}, ${log.logIndex}, ${projectId}, ${String(log.blockNumber)}, ${decoded.eventName}, ${sql.json(args)}) on conflict do nothing`;
    if (decoded.eventName === "Contributed") {
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
