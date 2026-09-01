import { databaseConfigured } from "@/lib/server/database";
import { getRobinhoodTokenList } from "@/lib/server/public-launch-registry";

export async function GET() {
  if (!databaseConfigured()) {
    return Response.json({ error: "Verified token registry is unavailable" }, { status: 503 });
  }
  try {
    return Response.json(await getRobinhoodTokenList(), {
      headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
    });
  } catch {
    return Response.json({ error: "Token list read failed" }, { status: 503 });
  }
}
