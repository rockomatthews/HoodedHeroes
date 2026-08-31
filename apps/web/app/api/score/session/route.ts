import { issueScoreSession } from "@hooded/score-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { wallet } = await request.json() as { wallet?: string };
  const secret = process.env.SCORE_SIGNING_SECRET;
  if (!secret || secret.length < 32) return Response.json({ error: "Score signing is not configured" }, { status: 503 });
  try { return Response.json(issueScoreSession(wallet ?? "", secret)); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Unable to create session" }, { status: 400 }); }
}
