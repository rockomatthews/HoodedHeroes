import { randomUUID } from "node:crypto";
import { z } from "zod";
import { databaseConfigured, db } from "@/lib/server/database";
import { assertSameOrigin, publicError, requireIdempotencyKey } from "@/lib/server/request-security";
import { getSocietySession } from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const channelSchema = z.enum(["society", "builders", "launch-review", "house-relay"]);
const messageSchema = z.object({ body: z.string().trim().min(1).max(280), channel: channelSchema });

async function requireHero() {
  const session = await getSocietySession();
  if (!session || session.access !== "hero") throw new Response("A HoodedHero-gated session is required", { status: 403 });
  return session;
}

function publicMessage(row: { id: string; owner_wallet: string; body: string; created_at: Date | string }) {
  const wallet = row.owner_wallet;
  return {
    id: row.id,
    author: `HERO ${wallet.slice(0, 6)}…${wallet.slice(-4)}`,
    body: row.body,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function publicActivity(row: { id: string; owner_wallet: string; channel: string; created_at: Date | string }) {
  const wallet = row.owner_wallet;
  return {
    id: `activity-${row.id}`,
    actor: `HERO ${wallet.slice(0, 6)}…${wallet.slice(-4)}`,
    action: "sent a Community Signal",
    channel: row.channel.replaceAll("-", " ").toUpperCase(),
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export async function GET(request: Request) {
  try {
    await requireHero();
    if (!databaseConfigured()) return Response.json({ error: "PostgreSQL is not configured" }, { status: 503 });
    const channel = channelSchema.parse(new URL(request.url).searchParams.get("channel") ?? "society");
    const sql = db();
    const [rows, activityRows] = await Promise.all([
      sql`select id, owner_wallet, body, created_at from community_messages where channel = ${channel} and moderation_status = 'visible' order by created_at desc limit 40`,
      sql`select id, owner_wallet, channel, created_at from community_messages where moderation_status = 'visible' order by created_at desc limit 8`,
    ]);
    return Response.json({
      messages: rows.reverse().map((row) => publicMessage(row as { id: string; owner_wallet: string; body: string; created_at: Date | string })),
      activity: activityRows.map((row) => publicActivity(row as { id: string; owner_wallet: string; channel: string; created_at: Date | string })),
    });
  } catch (error) {
    return publicError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const idempotencyKey = requireIdempotencyKey(request);
    const session = await requireHero();
    if (!databaseConfigured()) return Response.json({ error: "PostgreSQL is not configured" }, { status: 503 });
    const { body, channel } = messageSchema.parse(await request.json());
    const wallet = session.wallet.toLowerCase();
    const sql = db();
    const existing = await sql`select id, owner_wallet, body, created_at from community_messages where owner_wallet = ${wallet} and idempotency_key = ${idempotencyKey} limit 1`;
    if (existing[0]) return Response.json({ message: publicMessage(existing[0] as { id: string; owner_wallet: string; body: string; created_at: Date | string }) });
    const recent = await sql`select count(*)::int as count from community_messages where owner_wallet = ${wallet} and created_at > now() - interval '1 minute'`;
    if (Number(recent[0]?.count ?? 0) >= 5) return Response.json({ error: "Signal rate limit reached" }, { status: 429 });
    const inserted = await sql`insert into community_messages (id, idempotency_key, owner_wallet, channel, body) values (${randomUUID()}, ${idempotencyKey}, ${wallet}, ${channel}, ${body}) returning id, owner_wallet, body, created_at`;
    return Response.json({ message: publicMessage(inserted[0] as { id: string; owner_wallet: string; body: string; created_at: Date | string }) }, { status: 201 });
  } catch (error) {
    return publicError(error);
  }
}
