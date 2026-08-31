import { verifyScore } from "@hooded/score-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = process.env.SCORE_SIGNING_SECRET;
  if (!secret || secret.length < 32) return Response.json({ error: "Score signing is not configured" }, { status: 503 });
  try {
    const result = verifyScore(await request.json(), secret);
    return Response.json({ ...result, creditStatus: "requires-atomic-nonce-reservation" });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Score rejected" }, { status: 400 }); }
}
