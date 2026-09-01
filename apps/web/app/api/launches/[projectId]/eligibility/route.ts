import { getAddress, isAddress } from "viem";
import { z } from "zod";
import { databaseConfigured, db } from "@/lib/server/database";
import { issueEligibilityPermit } from "@/lib/server/launch-eligibility";
import { assertSameOrigin, publicError, requireDatabaseRateLimit, requireIdempotencyKey } from "@/lib/server/request-security";
import { getSocietySession } from "@/lib/server/session";

const bodySchema = z.object({ jurisdiction: z.string().regex(/^[A-Z]{2}$/), acceptedDisclosures: z.literal(true) });

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    assertSameOrigin(request);
    requireIdempotencyKey(request);
    const society = await getSocietySession();
    if (!society) return Response.json({ error: "A signed wallet session is required" }, { status: 401 });
    await requireDatabaseRateLimit("eligibility-permit", society.wallet, 10, 3_600);
    if (!databaseConfigured()) return Response.json({ error: "PostgreSQL is not configured" }, { status: 503 });
    const body = bodySchema.parse(await request.json());
    const { projectId } = await params;
    const sql = db();
    const rows = await sql`select sale_address, manifest from launches where project_id = ${projectId} and launch_class = 'production' and lifecycle in ('public-eligible', 'mainnet-verified') limit 1`;
    if (!rows[0] || !isAddress(String(rows[0].sale_address))) return Response.json({ error: "Eligible production launch not found" }, { status: 404 });
    const manifest = rows[0].manifest as { sale?: { maximumContributionPerWallet?: string } };
    const allowance = BigInt(manifest.sale?.maximumContributionPerWallet ?? "0");
    if (allowance <= 0n) return Response.json({ error: "Launch allowance is invalid" }, { status: 409 });
    const permit = await issueEligibilityPermit({ projectId, wallet: getAddress(society.wallet), sale: getAddress(String(rows[0].sale_address)), allowance, jurisdiction: body.jurisdiction });
    return Response.json(permit, { status: 201, headers: { "cache-control": "no-store" } });
  } catch (error) {
    return publicError(error);
  }
}
