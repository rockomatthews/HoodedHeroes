import { databaseConfigured, db } from "@/lib/server/database";
import { publicError } from "@/lib/server/request-security";
import { getSocietySession } from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const symbols = ["AAPL", "NVDA", "AMZN", "GOOGL", "MSFT", "TSLA"];

export async function GET() {
  try {
    const session = await getSocietySession();
    if (!session || session.access !== "hero") return Response.json({ error: "A Genesis-Hero-gated session is required" }, { status: 403 });
    if (!databaseConfigured()) return Response.json({ error: "PostgreSQL is not configured" }, { status: 503 });
    const rows = await db()`select identity_verified, jurisdiction_allowed, sanctions_clear, wallet_control_verified, expires_at from stock_token_eligibility where wallet_address = ${session.wallet.toLowerCase()} and expires_at > now() limit 1`;
    const row = rows[0];
    const eligible = Boolean(row?.identity_verified && row?.jurisdiction_allowed && row?.sanctions_clear && row?.wallet_control_verified);
    return Response.json({ eligibility: { identityVerified: Boolean(row?.identity_verified), jurisdictionAllowed: Boolean(row?.jurisdiction_allowed), sanctionsClear: Boolean(row?.sanctions_clear), walletControlVerified: Boolean(row?.wallet_control_verified), expiresAt: row?.expires_at ? new Date(String(row.expires_at)).toISOString() : null }, assets: symbols.map((symbol) => ({ symbol, status: eligible ? "eligible-no-funded-pool" : "locked" })) });
  } catch (error) { return publicError(error); }
}
