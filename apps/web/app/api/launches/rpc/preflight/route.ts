import { canaryModeEnabled, isLaunchCanaryOwner } from "@/lib/server/launch-canary";
import { preflightRobinhoodRpc } from "@/lib/server/robinhood-rpc";
import { getSocietySession } from "@/lib/server/session";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSocietySession();
  if (!session || !canaryModeEnabled() || !isLaunchCanaryOwner(session.wallet)) return Response.json({ error: "Owner-only RPC preflight is disabled" }, { status: 403 });
  const result = await preflightRobinhoodRpc();
  return Response.json(result, { status: result.ready ? 200 : 503, headers: { "Cache-Control": "private, no-store" } });
}
