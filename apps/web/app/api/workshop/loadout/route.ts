import { z } from "zod";
import { databaseConfigured, db } from "@/lib/server/database";
import { assertSameOrigin, publicError, requireDatabaseRateLimit, requireIdempotencyKey } from "@/lib/server/request-security";
import { getSocietySession } from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const loadoutSchema = z.object({ ability: z.enum(["GRID SURGE", "DRONE VEIL", "CIPHER SIGHT"]), gear: z.enum(["ARC RELAY", "SIGNAL CLOAK", "RESCUE BEACON"]) });

export async function PUT(request: Request) {
  try {
    assertSameOrigin(request); requireIdempotencyKey(request);
    const session = await getSocietySession();
    if (!session || session.access !== "hero") return Response.json({ error: "A Genesis-Hero-gated session is required" }, { status: 403 });
    if (!databaseConfigured()) return Response.json({ error: "PostgreSQL is not configured" }, { status: 503 });
    await requireDatabaseRateLimit("hero-loadout", session.wallet, 30, 3_600);
    const body = loadoutSchema.parse(await request.json());
    await db()`insert into hero_loadout_drafts (wallet_address, ability, gear, updated_at) values (${session.wallet.toLowerCase()}, ${body.ability}, ${body.gear}, now()) on conflict (wallet_address) do update set ability = excluded.ability, gear = excluded.gear, updated_at = now()`;
    return Response.json({ saved: true, loadout: body });
  } catch (error) { return publicError(error); }
}
