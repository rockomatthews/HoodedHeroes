import { HLAB1_MANIFEST, HLAB2_MANIFEST, HOODED_GENESIS_MANIFEST, validateLaunchManifest, type LaunchManifestV1 } from "@hooded/shared";
import { databaseConfigured, db } from "@/lib/server/database";
import { getSocietySession } from "@/lib/server/session";
import { assertSameOrigin, publicError, requireDatabaseRateLimit, requireIdempotencyKey } from "@/lib/server/request-security";
import { canaryModeEnabled, isLaunchCanaryOwner } from "@/lib/server/launch-canary";
import { immutableMetadataCoreMatches, manifestRecordHash, metadataRevisionMatches, metadataRevisionSignatureValid } from "@/lib/server/manifest-integrity";

export async function GET() {
  if (!databaseConfigured()) return Response.json({ launches: [HOODED_GENESIS_MANIFEST, HLAB1_MANIFEST, HLAB2_MANIFEST], source: "bundled-reviewed-manifests" });
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
    await requireDatabaseRateLimit("launch-manifest-create", session.wallet, 10, 3_600);
    if (!databaseConfigured()) return Response.json({ error: "PostgreSQL is not configured" }, { status: 503 });
    const manifest = await request.json() as LaunchManifestV1;
    const validation = validateLaunchManifest(manifest);
    if (!validation.ready) return Response.json({ error: "Manifest is blocked", validation }, { status: 422 });
    if (!metadataRevisionMatches(manifest)) return Response.json({ error: "Metadata revision hash does not match the canonical publication record" }, { status: 422 });
    if (!immutableMetadataCoreMatches(manifest.metadata)) return Response.json({ error: "Immutable metadata core hash is invalid" }, { status: 422 });
    if (!await metadataRevisionSignatureValid(manifest)) return Response.json({ error: "Metadata revision signature is invalid" }, { status: 422 });
    if (manifest.launchClass === "lab") {
      if (manifest.environment !== "mainnet-canary" || !canaryModeEnabled() || !isLaunchCanaryOwner(session.wallet)) {
        return Response.json({ error: "Owner-only mainnet lab creation is disabled" }, { status: 403 });
      }
    } else if (manifest.environment !== "mainnet" || process.env.ENABLE_PRODUCTION_LAUNCH_PREPARE !== "true") {
      return Response.json({ error: "Production manifest intake is disabled" }, { status: 403 });
    }
    if (manifest.metadata.creatorWallet.toLowerCase() !== session.wallet.toLowerCase()) return Response.json({ error: "Manifest creator must match the signed session wallet" }, { status: 403 });
    const hash = manifestRecordHash(manifest);
    const sql = db();
    const existing = await sql`select manifest, manifest_hash from launches where project_id = ${manifest.metadata.projectId} limit 1`;
    if (existing[0]) return Response.json(existing[0]);
    await sql.begin(async (tx) => {
      await tx`insert into launches (project_id, creator_wallet, chain, environment, launch_class, lifecycle, token_address, manifest, manifest_hash) values (${manifest.metadata.projectId}, ${session.wallet.toLowerCase()}, ${manifest.metadata.chain}, ${manifest.environment}, ${manifest.launchClass}, ${manifest.lifecycle}, ${manifest.metadata.tokenAddress ?? null}, ${tx.json(manifest)}, ${hash})`;
      await tx`insert into metadata_revisions (project_id, version, content_hash, previous_content_hash, author_wallet, signature, publication, change_reason, frozen) values (${manifest.metadata.projectId}, ${manifest.metadata.revision.version}, ${manifest.metadata.revision.contentHash}, ${manifest.metadata.revision.previousContentHash ?? null}, ${manifest.metadata.revision.authorWallet.toLowerCase()}, ${manifest.metadata.revision.signature}, ${tx.json(manifest.metadata.publication)}, ${manifest.metadata.revision.changeReason}, ${manifest.metadata.revision.frozen})`;
    });
    return Response.json({ manifest, manifestHash: hash, idempotencyKey: key }, { status: 201 });
  } catch (error) {
    return publicError(error);
  }
}
