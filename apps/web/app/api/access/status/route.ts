import { readWalletAccess, accessConfigurationReady } from "@/lib/server/onchain-access";
import { createSocietySession, getSocietySession } from "@/lib/server/session";
import { publicError, requireDatabaseRateLimit } from "@/lib/server/request-security";
import { databaseConfigured, db } from "@/lib/server/database";
import { canaryModeEnabled, isLaunchCanaryOwner } from "@/lib/server/launch-canary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!accessConfigurationReady()) {
      return Response.json(
        { configured: false, authenticated: false, access: "vestibule" },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const session = await getSocietySession();
    if (!session) {
      return Response.json(
        { configured: true, authenticated: false, access: "vestibule" },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    await requireDatabaseRateLimit("society-access-status", session.wallet, 30, 60);

    const evidence = canaryModeEnabled() && isLaunchCanaryOwner(session.wallet)
      ? { hoodedBalance: 0n, genesisHeroBalance: 0n, access: "hero" as const }
      : await readWalletAccess(session.wallet);

    if (databaseConfigured()) {
      const sql = db();
      await sql`insert into society_members (wallet_address, access_level, hooded_balance, genesis_hero_balance, last_verified_at) values (${session.wallet.toLowerCase()}, ${evidence.access}, ${evidence.hoodedBalance.toString()}, ${evidence.genesisHeroBalance.toString()}, now()) on conflict (wallet_address) do update set access_level = excluded.access_level, hooded_balance = excluded.hooded_balance, genesis_hero_balance = excluded.genesis_hero_balance, last_verified_at = now()`;
    }

    const refreshed = await createSocietySession({ wallet: session.wallet, access: evidence.access }, session.expiresAt);
    return Response.json({
      configured: true,
      authenticated: true,
      wallet: session.wallet,
      access: evidence.access,
      hoodedBalance: evidence.hoodedBalance.toString(),
      genesisHeroBalance: evidence.genesisHeroBalance.toString(),
      expiresAt: refreshed.expiresAt,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return publicError(error);
  }
}
