import { createHash, randomUUID } from "node:crypto";
import { verifyMessage } from "viem";
import { z } from "zod";
import { db } from "@/lib/server/database";
import { assertSameOrigin, publicError, requireDatabaseRateLimit, requireIdempotencyKey } from "@/lib/server/request-security";
import { getSocietySession } from "@/lib/server/session";

const bodySchema = z.object({
  sessionId: z.string().uuid(),
  branch: z.string().regex(/^codex\/[a-z0-9][a-z0-9-]{2,60}$/),
  commitSha: z.string().regex(/^[a-fA-F0-9]{40}$/),
  buildHash: z.string().regex(/^[a-fA-F0-9]{64}$/),
  testEvidence: z.array(z.string().regex(/^[a-fA-F0-9]{64}$/)).min(1).max(20),
  signature: z.string().regex(/^0x[a-fA-F0-9]+$/),
});

function attestation(body: Omit<z.infer<typeof bodySchema>, "signature">, wallet: string) {
  return ["HOODED CODE BAZAAR CONTRIBUTION", `Wallet: ${wallet.toLowerCase()}`, `Session: ${body.sessionId}`, `Branch: ${body.branch}`, `Commit: ${body.commitSha}`, `Build: ${body.buildHash}`, `Evidence: ${createHash("sha256").update(body.testEvidence.join("\n")).digest("hex")}`, "DCO: I certify that I have the right to submit this contribution under AGPL-3.0-or-later."].join("\n");
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    requireIdempotencyKey(request);
    const society = await getSocietySession();
    if (!society || society.access !== "hero") return Response.json({ error: "A Genesis-Hero-gated session is required" }, { status: 403 });
    await requireDatabaseRateLimit("code-proposal", society.wallet, 12, 3_600);
    const parsed = bodySchema.parse(await request.json());
    const { signature, ...body } = parsed;
    const valid = await verifyMessage({ address: society.wallet, message: attestation(body, society.wallet), signature: signature as `0x${string}` });
    if (!valid) return Response.json({ error: "Invalid contribution attestation" }, { status: 401 });
    const sql = db();
    const sessions = await sql`select id from sandbox_sessions where id = ${body.sessionId} and owner_wallet = ${society.wallet.toLowerCase()} and expires_at > now() limit 1`;
    if (!sessions[0]) return Response.json({ error: "Sandbox session not found or expired" }, { status: 404 });
    const passed = await sql`select preset, output_hash from sandbox_runs where session_id = ${body.sessionId} and exit_code = 0 and preset in ('test', 'build', 'contract-test', 'security-scan')`;
    if (passed.length < 2) return Response.json({ error: "Required sandbox checks have not passed" }, { status: 409 });
    const id = randomUUID();
    await sql`insert into contribution_proposals (id, session_id, author_wallet, branch_name, commit_sha, build_hash, test_evidence, status) values (${id}, ${body.sessionId}, ${society.wallet.toLowerCase()}, ${body.branch}, ${body.commitSha}, ${body.buildHash}, ${sql.json(body.testEvidence)}, 'checks-passed')`;
    return Response.json({ id, status: "checks-passed", branch: body.branch }, { status: 201 });
  } catch (error) {
    return publicError(error);
  }
}
