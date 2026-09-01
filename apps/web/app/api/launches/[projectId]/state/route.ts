import { databaseConfigured, db } from "@/lib/server/database";

export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  if (!databaseConfigured()) return Response.json({ error: "Launch index is not configured" }, { status: 503 });
  const { projectId } = await params;
  const sql = db();
  const [launches, totals, liquidity, events] = await Promise.all([
    sql`select project_id, chain, environment, launch_class, lifecycle, token_address, sale_address, manifest_hash, updated_at from launches where project_id = ${projectId} limit 1`,
    sql`select count(*)::integer as contributors, coalesce(sum(contributed), 0) as contributed, coalesce(sum(accepted), 0) as accepted, coalesce(sum(refunded), 0) as refunded, coalesce(sum(token_allocation), 0) as token_allocation from launch_contributions where project_id = ${projectId}`,
    sql`select coordinator_address, lock_address, position_manager, token_address, quote_token_address, venue_identifier, pool_id, fee, tick_spacing, hook_address, position_id, quote_amount, token_amount, permanently_locked, finalization_transaction_hash, verified_at from liquidity_positions where project_id = ${projectId} limit 1`,
    sql`select transaction_hash, log_index, block_number, event_name, payload, observed_at from launch_events where project_id = ${projectId} order by block_number desc, log_index desc limit 100`,
  ]);
  if (!launches[0]) return Response.json({ error: "Launch not found" }, { status: 404 });
  return Response.json({ launch: launches[0], totals: totals[0], liquidity: liquidity[0] ?? null, events }, { headers: { "cache-control": "public, max-age=5, stale-while-revalidate=20" } });
}
