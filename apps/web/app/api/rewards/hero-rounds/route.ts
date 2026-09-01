import { readHeroRewardLedger } from "@/lib/server/hero-reward-ledger";

export const runtime = "nodejs";

export async function GET() {
  const ledger = await readHeroRewardLedger();
  return Response.json(ledger, {
    status: ledger.status === "unavailable" ? 503 : 200,
    headers: { "Cache-Control": ledger.status === "live" ? "public, s-maxage=15, stale-while-revalidate=45" : "public, s-maxage=60" },
  });
}
