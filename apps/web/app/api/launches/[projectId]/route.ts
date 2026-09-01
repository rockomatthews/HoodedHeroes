import { HLAB1_MANIFEST, HLAB2_MANIFEST, HOODED_GENESIS_MANIFEST } from "@hooded/shared";
import { databaseConfigured, db } from "@/lib/server/database";

export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  if (!databaseConfigured()) {
    const bundled = [HOODED_GENESIS_MANIFEST, HLAB1_MANIFEST, HLAB2_MANIFEST].find((launch) => launch.metadata.projectId === projectId);
    if (bundled) return Response.json(bundled);
    return Response.json({ error: "Launch not found" }, { status: 404 });
  }
  const sql = db();
  const rows = await sql`select manifest, manifest_hash, created_at, updated_at from launches where project_id = ${projectId} limit 1`;
  if (!rows[0]) return Response.json({ error: "Launch not found" }, { status: 404 });
  return Response.json(rows[0], { headers: { "Cache-Control": "public, max-age=15, stale-while-revalidate=60" } });
}
