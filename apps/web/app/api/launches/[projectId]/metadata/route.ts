import { canonicalJson, launchMetadataImmutableCore, type LaunchManifestV1, type LaunchMetadataV1 } from "@hooded/shared";
import { databaseConfigured, db } from "@/lib/server/database";
import { getSocietySession } from "@/lib/server/session";
import { assertSameOrigin, publicError, requireDatabaseRateLimit, requireIdempotencyKey } from "@/lib/server/request-security";
import { computedLaunchMetadataRevisionHash, immutableMetadataCoreMatches, launchMetadataRevisionSignatureValid, manifestRecordHash } from "@/lib/server/manifest-integrity";

export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  if (!databaseConfigured()) return Response.json({ revisions: [], source: "not-configured" });
  const { projectId } = await params;
  const sql = db();
  const rows = await sql`select version, content_hash, previous_content_hash, author_wallet, signature, publication, change_reason, frozen, created_at from metadata_revisions where project_id = ${projectId} order by version desc limit 100`;
  return Response.json({ projectId, revisions: rows }, { headers: { "cache-control": "public, max-age=30, stale-while-revalidate=300" } });
}

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    assertSameOrigin(request);
    requireIdempotencyKey(request);
    const society = await getSocietySession();
    if (!society || society.access !== "hero") return Response.json({ error: "A Genesis-Hero-gated session is required" }, { status: 403 });
    await requireDatabaseRateLimit("metadata-revision", society.wallet, 20, 3_600);
    if (!databaseConfigured()) return Response.json({ error: "PostgreSQL is not configured" }, { status: 503 });
    const { projectId } = await params;
    const metadata = await request.json() as LaunchMetadataV1;
    if (metadata.projectId !== projectId || metadata.revision.authorWallet.toLowerCase() !== society.wallet.toLowerCase()) return Response.json({ error: "Metadata author or project mismatch" }, { status: 403 });
    if (computedLaunchMetadataRevisionHash(metadata) !== metadata.revision.contentHash.toLowerCase() || !immutableMetadataCoreMatches(metadata) || !await launchMetadataRevisionSignatureValid(metadata)) return Response.json({ error: "Metadata revision, immutable core, or signature is invalid" }, { status: 422 });
    const sql = db();
    const replay = await sql`select version, content_hash, created_at from metadata_revisions where project_id = ${projectId} and content_hash = ${metadata.revision.contentHash} limit 1`;
    if (replay[0]) return Response.json({ metadataRevision: replay[0], replayed: true });
    const rows = await sql`select creator_wallet, manifest from launches where project_id = ${projectId} limit 1`;
    if (!rows[0]) return Response.json({ error: "Launch not found" }, { status: 404 });
    if (String(rows[0].creator_wallet).toLowerCase() !== society.wallet.toLowerCase()) return Response.json({ error: "Only the bound creator may publish a revision" }, { status: 403 });
    const manifest = (rows[0].manifest as LaunchManifestV1);
    if (manifest.metadata.revision.frozen) return Response.json({ error: "Publication metadata is permanently frozen" }, { status: 409 });
    if (canonicalJson(launchMetadataImmutableCore(manifest.metadata)) !== canonicalJson(launchMetadataImmutableCore(metadata))) return Response.json({ error: "Immutable launch identity cannot be revised" }, { status: 409 });
    if (metadata.revision.version !== manifest.metadata.revision.version + 1 || metadata.revision.previousContentHash?.toLowerCase() !== manifest.metadata.revision.contentHash.toLowerCase()) return Response.json({ error: "Metadata revision history is not contiguous" }, { status: 409 });
    const revised: LaunchManifestV1 = { ...manifest, metadata };
    const revisedHash = manifestRecordHash(revised);
    await sql.begin(async (tx) => {
      await tx`insert into metadata_revisions (project_id, version, content_hash, previous_content_hash, author_wallet, signature, publication, change_reason, frozen) values (${projectId}, ${metadata.revision.version}, ${metadata.revision.contentHash}, ${metadata.revision.previousContentHash ?? null}, ${society.wallet.toLowerCase()}, ${metadata.revision.signature}, ${tx.json(metadata.publication)}, ${metadata.revision.changeReason}, ${metadata.revision.frozen})`;
      await tx`update launches set manifest = ${tx.json(revised)}, manifest_hash = ${revisedHash}, updated_at = now() where project_id = ${projectId}`;
    });
    return Response.json({ metadata, manifestHash: revisedHash }, { status: 201 });
  } catch (error) {
    return publicError(error);
  }
}
