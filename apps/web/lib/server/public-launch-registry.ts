import { isAddress } from "viem";
import { db } from "./database";
import {
  buildRobinhoodRegistryRecord,
  buildRobinhoodTokenListFromRegistrySources,
  type RegistryEventRow,
  type RegistryLaunchRow,
  type RegistryPositionRow,
  type RegistryProviderRow,
  type RegistrySource,
} from "../public-launch-registry-core";

async function rowsForLaunch(projectId: string) {
  const sql = db();
  const [positions, events, providers] = await Promise.all([
    sql`select coordinator_address, lock_address, position_manager, position_id, token_address, quote_token_address, venue_identifier, pool_id, fee, tick_spacing, hook_address, finalization_transaction_hash, permanently_locked, verified_at from liquidity_positions where project_id = ${projectId} limit 1`,
    sql`select event_name, transaction_hash from launch_events where project_id = ${projectId} order by block_number desc, log_index desc`,
    sql`select provider, status, evidence_url, confirmed_at from launch_provider_readiness where project_id = ${projectId}`,
  ]);
  return { position: positions[0] as unknown as RegistryPositionRow | undefined, events: events as unknown as RegistryEventRow[], providers: providers as unknown as RegistryProviderRow[] };
}

export async function getRobinhoodRegistryRecord(tokenAddress: string) {
  if (!isAddress(tokenAddress)) return null;
  const sql = db();
  const rows = await sql`select project_id, chain, lifecycle, token_address, sale_address, factory_address, manifest_hash, manifest from launches where chain = 'robinhood' and lower(token_address) = ${tokenAddress.toLowerCase()} limit 1`;
  if (!rows[0]) return null;
  const launch = rows[0] as unknown as RegistryLaunchRow;
  return buildRobinhoodRegistryRecord({ launch, ...await rowsForLaunch(launch.project_id) });
}

export async function getRobinhoodTokenList() {
  const sql = db();
  const rows = await sql`select project_id, chain, lifecycle, token_address, sale_address, factory_address, manifest_hash, manifest from launches where chain = 'robinhood' and lifecycle = 'public-eligible' and token_address is not null order by project_id`;
  const sources: RegistrySource[] = [];
  for (const raw of rows) {
    const launch = raw as unknown as RegistryLaunchRow;
    sources.push({ launch, ...await rowsForLaunch(launch.project_id) });
  }
  return buildRobinhoodTokenListFromRegistrySources(sources, new Date().toISOString());
}
