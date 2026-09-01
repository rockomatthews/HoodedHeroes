import { stopCommunitySandbox } from "@/lib/server/sandbox-control";
import { db } from "@/lib/server/database";
import { assertSameOrigin, publicError } from "@/lib/server/request-security";
import { getSocietySession } from "@/lib/server/session";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const society = await getSocietySession();
    if (!society || society.access !== "hero") return Response.json({ error: "A Genesis-Hero-gated session is required" }, { status: 403 });
    const { id } = await params;
    const sql = db();
    const rows = await sql`select provider_session_id from sandbox_sessions where id = ${id} and owner_wallet = ${society.wallet.toLowerCase()} limit 1`;
    if (!rows[0]) return Response.json({ error: "Sandbox session not found" }, { status: 404 });
    await stopCommunitySandbox(String(rows[0].provider_session_id));
    await sql`update sandbox_sessions set status = 'stopped' where id = ${id}`;
    return Response.json({ stopped: true, id });
  } catch (error) {
    return publicError(error);
  }
}
