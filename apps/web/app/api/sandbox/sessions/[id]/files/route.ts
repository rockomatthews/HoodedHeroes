import { z } from "zod";
import { db } from "@/lib/server/database";
import { getSocietySession } from "@/lib/server/session";
import { assertSameOrigin, publicError, requireDatabaseRateLimit, requireIdempotencyKey } from "@/lib/server/request-security";
import { readSandboxFile, writeSandboxFile } from "@/lib/server/sandbox-control";

export const runtime = "nodejs";
const writeSchema = z.object({ path: z.string().min(1).max(240), content: z.string().max(262_144) });

async function ownedProviderSession(id: string, wallet: string) {
  const sql = db();
  const rows = await sql`select provider_session_id from sandbox_sessions where id = ${id} and owner_wallet = ${wallet.toLowerCase()} and status <> 'stopped' and expires_at > now() limit 1`;
  return rows[0] ? String(rows[0].provider_session_id) : null;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const society = await getSocietySession();
    if (!society || society.access !== "hero") return Response.json({ error: "A Genesis-Hero-gated session is required" }, { status: 403 });
    await requireDatabaseRateLimit("sandbox-file-write", society.wallet, 120, 3_600);
    const { id } = await params;
    const providerSessionId = await ownedProviderSession(id, society.wallet);
    if (!providerSessionId) return Response.json({ error: "Sandbox session not found or expired" }, { status: 404 });
    const path = new URL(request.url).searchParams.get("path") ?? "";
    return Response.json(await readSandboxFile(providerSessionId, path), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return publicError(error);
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const idempotencyKey = requireIdempotencyKey(request);
    const society = await getSocietySession();
    if (!society || society.access !== "hero") return Response.json({ error: "A Genesis-Hero-gated session is required" }, { status: 403 });
    const { id } = await params;
    const providerSessionId = await ownedProviderSession(id, society.wallet);
    if (!providerSessionId) return Response.json({ error: "Sandbox session not found or expired" }, { status: 404 });
    const sql = db();
    const prior = await sql`select path, content_hash, bytes from sandbox_file_changes where session_id = ${id} and idempotency_key = ${idempotencyKey} limit 1`;
    if (prior[0]) return Response.json(prior[0]);
    const body = writeSchema.parse(await request.json());
    const result = await writeSandboxFile(providerSessionId, body.path, body.content);
    await sql`insert into sandbox_file_changes (session_id, idempotency_key, path, content_hash, bytes, author_wallet) values (${id}, ${idempotencyKey}, ${result.path}, ${result.contentHash}, ${result.bytes}, ${society.wallet.toLowerCase()})`;
    return Response.json(result, { status: 201 });
  } catch (error) {
    return publicError(error);
  }
}
