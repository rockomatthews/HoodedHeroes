import { verifyMessage } from "viem";
import { z } from "zod";
import { readWalletAccess } from "@/lib/server/onchain-access";
import { challengeMessage, consumeChallenge, createSocietySession, readChallenge } from "@/lib/server/session";
import { assertSameOrigin, publicError, requireDatabaseRateLimit } from "@/lib/server/request-security";
import { databaseConfigured, db } from "@/lib/server/database";
import { canaryModeEnabled, isLaunchCanaryOwner } from "@/lib/server/launch-canary";

export const runtime = "nodejs";
const bodySchema = z.object({ wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/), signature: z.string().regex(/^0x[a-fA-F0-9]+$/) });

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = bodySchema.parse(await request.json());
    const challenge = await readChallenge();
    if (!challenge) return Response.json({ error: "Challenge expired" }, { status: 401 });
    const wallet = body.wallet as `0x${string}`;
    const valid = await verifyMessage({ address: wallet, message: challengeMessage(challenge, wallet), signature: body.signature as `0x${string}` });
    if (!valid) return Response.json({ error: "Invalid wallet signature" }, { status: 401 });
    await requireDatabaseRateLimit("society-access-verify", wallet, 10, 15 * 60);
    const evidence = canaryModeEnabled() && isLaunchCanaryOwner(wallet)
      ? { hoodedBalance: 0n, genesisHeroBalance: 0n, access: "hero" as const }
      : await readWalletAccess(wallet);
    if (databaseConfigured()) {
      const sql = db();
      await sql`insert into society_members (wallet_address, access_level, hooded_balance, genesis_hero_balance, last_verified_at) values (${wallet.toLowerCase()}, ${evidence.access}, ${evidence.hoodedBalance.toString()}, ${evidence.genesisHeroBalance.toString()}, now()) on conflict (wallet_address) do update set access_level = excluded.access_level, hooded_balance = excluded.hooded_balance, genesis_hero_balance = excluded.genesis_hero_balance, last_verified_at = now()`;
    }
    await createSocietySession({ wallet, access: evidence.access });
    await consumeChallenge();
    return Response.json({ wallet, access: evidence.access, hoodedBalance: evidence.hoodedBalance.toString(), genesisHeroBalance: evidence.genesisHeroBalance.toString() });
  } catch (error) {
    return publicError(error);
  }
}
