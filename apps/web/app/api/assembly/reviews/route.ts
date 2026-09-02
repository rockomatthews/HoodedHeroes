import { randomUUID } from "node:crypto";
import { z } from "zod";
import { databaseConfigured, db } from "@/lib/server/database";
import { assertSameOrigin, publicError, requireDatabaseRateLimit, requireIdempotencyKey } from "@/lib/server/request-security";
import { getSocietySession } from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const reviewSchema = z.object({ projectId: z.string().min(2).max(80), decision: z.enum(["approve", "request-changes"]), evidenceHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/) });

export async function POST(request: Request) {
  try {
    assertSameOrigin(request); requireIdempotencyKey(request);
    const session = await getSocietySession();
    if (!session || session.access !== "hero") return Response.json({ error: "A Genesis-Hero-gated session is required" }, { status: 403 });
    if (!databaseConfigured()) return Response.json({ error: "PostgreSQL is not configured" }, { status: 503 });
    await requireDatabaseRateLimit("assembly-peer-review", session.wallet, 20, 3_600);
    const body = reviewSchema.parse(await request.json());
    const sql = db();
    const launch = await sql`select project_id from launches where project_id = ${body.projectId} limit 1`;
    if (!launch[0]) return Response.json({ error: "Launch proposal was not found" }, { status: 404 });
    const rows = await sql`insert into launch_reviews (id, project_id, reviewer_wallet, kind, decision, evidence_hash) values (${randomUUID()}, ${body.projectId}, ${session.wallet.toLowerCase()}, 'peer', ${body.decision}, ${body.evidenceHash.toLowerCase()}) on conflict (project_id, reviewer_wallet, kind, evidence_hash) do nothing returning id, created_at`;
    return Response.json({ recorded: true, review: rows[0] ?? null }, { status: rows[0] ? 201 : 200 });
  } catch (error) { return publicError(error); }
}
