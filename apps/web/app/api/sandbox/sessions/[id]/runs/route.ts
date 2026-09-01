import { z } from "zod";
import { runSandboxPreset } from "@/lib/server/sandbox-control";
import { getSocietySession } from "@/lib/server/session";
import { assertSameOrigin, publicError, requireDatabaseRateLimit, requireIdempotencyKey } from "@/lib/server/request-security";
import { db } from "@/lib/server/database";

export const runtime = "nodejs";
export const maxDuration = 60;
const bodySchema = z.object({ preset: z.enum(["install", "typecheck", "test", "build", "contract-test", "security-scan"]) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const key = requireIdempotencyKey(request);
    const society = await getSocietySession();
    if (!society || society.access !== "hero") return Response.json({ error: "A Genesis-Hero-gated session is required" }, { status: 403 });
    await requireDatabaseRateLimit("sandbox-run", society.wallet, 40, 3_600);
    const { id } = await params;
    const body = bodySchema.parse(await request.json());
    const sql = db();
    const rows = await sql`select provider_session_id from sandbox_sessions where id = ${id} and owner_wallet = ${society.wallet.toLowerCase()} and expires_at > now() limit 1`;
    if (!rows[0]) return Response.json({ error: "Sandbox session not found or expired" }, { status: 404 });
    const prior = await sql`select id, preset, exit_code, stdout, stderr, output_hash from sandbox_runs where idempotency_key = ${key} and session_id = ${id} limit 1`;
    if (prior[0]) return Response.json(prior[0]);
    const run = await runSandboxPreset(String(rows[0].provider_session_id), body.preset);
    await sql`insert into sandbox_runs (id, idempotency_key, session_id, preset, input_hash, exit_code, stdout, stderr, output_hash, finished_at) values (${run.id}, ${key}, ${id}, ${body.preset}, ${run.outputHash}, ${run.exitCode}, ${run.stdout}, ${run.stderr}, ${run.outputHash}, now())`;
    return Response.json(run, { status: 201 });
  } catch (error) {
    return publicError(error);
  }
}
