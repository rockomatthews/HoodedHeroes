import { z } from "zod";
import { createProposalPullRequest } from "@/lib/server/github-control";
import { assertSameOrigin, publicError, requireDatabaseRateLimit, requireIdempotencyKey } from "@/lib/server/request-security";
import { getSocietySession } from "@/lib/server/session";
import { db } from "@/lib/server/database";

const bodySchema = z.object({ proposalId: z.string().uuid(), title: z.string().min(8).max(120) });

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    requireIdempotencyKey(request);
    const society = await getSocietySession();
    if (!society || society.access !== "hero") return Response.json({ error: "A Genesis-Hero-gated session is required" }, { status: 403 });
    await requireDatabaseRateLimit("pull-request-export", society.wallet, 6, 3_600);
    const body = bodySchema.parse(await request.json());
    const sql = db();
    const rows = await sql`select branch_name, build_hash, test_evidence, status from contribution_proposals where id = ${body.proposalId} and author_wallet = ${society.wallet.toLowerCase()} limit 1`;
    if (!rows[0]) return Response.json({ error: "Contribution proposal was not found" }, { status: 404 });
    if (!['checks-passed', 'peer-reviewed', 'security-approved'].includes(String(rows[0].status))) return Response.json({ error: "Proposal checks have not passed" }, { status: 409 });
    const pull = await createProposalPullRequest({ branch: String(rows[0].branch_name), title: body.title, body: `HOODED Code Bazaar proposal ${body.proposalId}\n\nBuild: ${rows[0].build_hash}\n\nEvidence: ${JSON.stringify(rows[0].test_evidence)}\n\nDCO: Signed-off-by wallet ${society.wallet}` });
    await sql`update contribution_proposals set pull_request_number = ${pull.number}, pull_request_url = ${pull.html_url}, updated_at = now() where id = ${body.proposalId}`;
    return Response.json(pull, { status: 201 });
  } catch (error) {
    return publicError(error);
  }
}
