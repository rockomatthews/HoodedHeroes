import { HERO_GENESIS_MANIFEST } from "@hoodedheroes/shared";
import { databaseConfigured, db } from "@/lib/server/database";

export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  if (!databaseConfigured()) {
    if (projectId === HERO_GENESIS_MANIFEST.metadata.projectId) return Response.json(HERO_GENESIS_MANIFEST);
    return Response.json({ error: "Launch not found" }, { status: 404 });
  }
  const sql = db();
  const rows = await sql`select manifest, manifest_hash, created_at, updated_at from launches where project_id = ${projectId} limit 1`;
  if (!rows[0]) return Response.json({ error: "Launch not found" }, { status: 404 });
  return Response.json(rows[0], { headers: { "Cache-Control": "public, max-age=15, stale-while-revalidate=60" } });
}
