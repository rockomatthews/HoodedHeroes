import { HOODED_GENESIS_MANIFEST, validateLaunchManifest, type LaunchManifestV1 } from "@hooded/shared";
import { databaseConfigured, db } from "@/lib/server/database";
import { getSocietySession } from "@/lib/server/session";
import { assertSameOrigin, publicError, requireIdempotencyKey } from "@/lib/server/request-security";
import { canaryModeEnabled, isLaunchCanaryOwner } from "@/lib/server/launch-canary";
import { manifestRecordHash, metadataRevisionMatches } from "@/lib/server/manifest-integrity";

export async function GET() {
  if (!databaseConfigured()) return Response.json({ launches: [HOODED_GENESIS_MANIFEST], source: "bundled-mainnet-canary-manifest" });
  const sql = db();
  const rows = await sql`select manifest from launches order by created_at desc limit 50`;
  return Response.json({ launches: rows.map((row) => (row as Record<string, unknown>).manifest), source: "postgres" }, { headers: { "Cache-Control": "public, max-age=15, stale-while-revalidate=60" } });
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const key = requireIdempotencyKey(request);
    const session = await getSocietySession();
    if (!session || session.access !== "hero") return Response.json({ error: "A Genesis-Hero-gated session is required" }, { status: 403 });
    if (!canaryModeEnabled() || !isLaunchCanaryOwner(session.wallet)) return Response.json({ error: "Owner-only mainnet canary creation is disabled" }, { status: 403 });
    if (!databaseConfigured()) return Response.json({ error: "PostgreSQL is not configured" }, { status: 503 });
    const manifest = await request.json() as LaunchManifestV1;
    const validation = validateLaunchManifest(manifest);
    if (!validation.ready) return Response.json({ error: "Manifest is blocked", validation }, { status: 422 });
    if (!metadataRevisionMatches(manifest)) return Response.json({ error: "Metadata revision hash does not match the canonical publication record" }, { status: 422 });
    if (manifest.environment !== "mainnet-canary") return Response.json({ error: "Only sealed mainnet canary manifests are accepted" }, { status: 403 });
    if (manifest.metadata.creatorWallet.toLowerCase() !== session.wallet.toLowerCase()) return Response.json({ error: "Manifest creator must match the signed canary owner" }, { status: 403 });
    const hash = manifestRecordHash(manifest);
    const sql = db();
    const existing = await sql`select manifest, manifest_hash from launches where project_id = ${manifest.metadata.projectId} limit 1`;
    if (existing[0]) return Response.json(existing[0]);
    await sql`insert into launches (project_id, creator_wallet, chain, environment, lifecycle, token_address, manifest, manifest_hash) values (${manifest.metadata.projectId}, ${session.wallet.toLowerCase()}, ${manifest.metadata.chain}, ${manifest.environment}, ${manifest.lifecycle}, ${manifest.metadata.tokenAddress ?? null}, ${sql.json(manifest)}, ${hash})`;
    return Response.json({ manifest, manifestHash: hash, idempotencyKey: key }, { status: 201 });
  } catch (error) {
    return publicError(error);
  }
}
