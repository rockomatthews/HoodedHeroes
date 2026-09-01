import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { getSocietySession } from "@/lib/server/session";
import { githubConfigured, githubOAuthUrl } from "@/lib/server/github-control";

export const runtime = "nodejs";

export async function GET() {
  const society = await getSocietySession();
  if (!society || society.access !== "hero") return Response.json({ error: "A Genesis-Hero-gated session is required" }, { status: 403 });
  if (!githubConfigured()) return Response.json({ error: "GitHub App access is not configured" }, { status: 503 });
  const state = randomBytes(24).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set("hooded_github_state", state, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 600 });
  return Response.redirect(githubOAuthUrl(state));
}
