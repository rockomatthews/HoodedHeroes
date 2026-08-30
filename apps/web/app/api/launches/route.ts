import { createHash } from "node:crypto";
import { HERO_GENESIS_MANIFEST, validateLaunchManifest, type LaunchManifestV1 } from "@hoodedheroes/shared";
import { databaseConfigured, db } from "@/lib/server/database";
import { getSocietySession } from "@/lib/server/session";
import { assertSameOrigin, publicError, requireIdempotencyKey } from "@/lib/server/request-security";

export async function GET() {
  if (!databaseConfigured()) return Response.json({ launches: [HERO_GENESIS_MANIFEST], source: "bundled-testnet-manifest" });
  const sql = db();
  const rows = await sql`select manifest from launches order by created_at desc limit 50`;
  return Response.json({ launches: rows.map((row) => (row as Record<string, unknown>).manifest), source: "postgres" }, { headers: { "Cache-Control": "public, max-age=15, stale-while-revalidate=60" } });
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const key = requireIdempotencyKey(request);
    const session = await getSocietySession();
    if (!session || session.access !== "hero") return Response.json({ error: "A HoodedHero-gated session is required" }, { status: 403 });
    if (!databaseConfigured()) return Response.json({ error: "PostgreSQL is not configured" }, { status: 503 });
    const manifest = await request.json() as LaunchManifestV1;
    const validation = validateLaunchManifest(manifest);
    if (!validation.ready) return Response.json({ error: "Manifest is blocked", validation }, { status: 422 });
    if (manifest.environment !== "testnet") return Response.json({ error: "Mainnet preparation is disabled" }, { status: 403 });
    const hash = createHash("sha256").update(JSON.stringify(manifest)).digest("hex");
    const sql = db();
    const existing = await sql`select manifest, manifest_hash from launches where project_id = ${manifest.metadata.projectId} limit 1`;
    if (existing[0]) return Response.json(existing[0]);
    await sql`insert into launches (project_id, creator_wallet, chain, environment, lifecycle, token_address, manifest, manifest_hash) values (${manifest.metadata.projectId}, ${session.wallet.toLowerCase()}, ${manifest.metadata.chain}, ${manifest.environment}, ${manifest.lifecycle}, ${manifest.metadata.tokenAddress ?? null}, ${sql.json(manifest)}, ${hash})`;
    return Response.json({ manifest, manifestHash: hash, idempotencyKey: key }, { status: 201 });
  } catch (error) {
    return publicError(error);
  }
}
