import { databaseConfigured } from "@/lib/server/database";
import { getRobinhoodRegistryRecord } from "@/lib/server/public-launch-registry";
import { robinhoodRegistryHttpResult } from "@/lib/public-launch-registry-core";

export async function GET(_request: Request, context: { params: Promise<{ tokenAddress: string }> }) {
  const { tokenAddress } = await context.params;
  if (!databaseConfigured()) {
    return Response.json({ error: "Verified launch registry is unavailable" }, { status: 503 });
  }
  try {
    const record = await getRobinhoodRegistryRecord(tokenAddress);
    const result = robinhoodRegistryHttpResult(record);
    return Response.json(result.body, {
      status: result.status,
      headers: { "Cache-Control": "public, max-age=15, stale-while-revalidate=60" },
    });
  } catch {
    return Response.json({ error: "Launch registry read failed" }, { status: 503 });
  }
}
