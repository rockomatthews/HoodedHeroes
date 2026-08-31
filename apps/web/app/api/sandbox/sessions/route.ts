import { z } from "zod";
import { APPROVED_SANDBOX_REPOSITORIES } from "@hooded/shared";
import { createCommunitySandbox, sandboxEnabled } from "@/lib/server/sandbox-control";
import { getSocietySession } from "@/lib/server/session";
import { assertSameOrigin, publicError, requireIdempotencyKey } from "@/lib/server/request-security";
import { databaseConfigured, db } from "@/lib/server/database";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({ repository: z.enum(APPROVED_SANDBOX_REPOSITORIES), runtime: z.enum(["web-evm-v1", "solana-v1"]) });

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const key = requireIdempotencyKey(request);
    const session = await getSocietySession();
    if (!session || session.access !== "hero") return Response.json({ error: "A Genesis-Hero-gated session is required" }, { status: 403 });
    if (!databaseConfigured()) return Response.json({ error: "PostgreSQL is not configured", enabled: false }, { status: 503 });
    if (!sandboxEnabled()) return Response.json({ error: "Vercel Sandbox is not enabled", enabled: false }, { status: 503 });
    const body = bodySchema.parse(await request.json());
    const baseCommit = process.env.SANDBOX_BASE_COMMIT;
    if (!baseCommit || !/^[a-fA-F0-9]{40}$/.test(baseCommit)) return Response.json({ error: "SANDBOX_BASE_COMMIT must be a full approved commit hash" }, { status: 503 });
    const sql = db();
    const existing = await sql`select id, provider_session_id, status, preview_url, expires_at from sandbox_sessions where idempotency_key = ${key} and owner_wallet = ${session.wallet.toLowerCase()} limit 1`;
    if (existing[0]) return Response.json(existing[0]);
    const created = await createCommunitySandbox({ ...body, baseCommit });
    await sql`insert into sandbox_sessions (id, idempotency_key, owner_wallet, repository, base_commit, runtime_image, provider_session_id, status, preview_url, expires_at) values (${created.id}, ${key}, ${session.wallet.toLowerCase()}, ${body.repository}, ${baseCommit}, ${body.runtime}, ${created.providerSessionId}, ${created.status}, ${created.previewUrl}, ${created.expiresAt})`;
    return Response.json(created, { status: 201 });
  } catch (error) {
    return publicError(error);
  }
}
