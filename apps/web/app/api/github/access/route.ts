import { databaseConfigured, db } from "@/lib/server/database";
import { approvedGitHubRepository, githubConfigured } from "@/lib/server/github-control";
import { getSocietySession } from "@/lib/server/session";

export async function GET() {
  const society = await getSocietySession();
  if (!society || society.access !== "hero") return Response.json({ eligible: false, connected: false }, { status: 403 });
  if (!databaseConfigured()) return Response.json({ eligible: true, connected: false, configured: false });
  const sql = db();
  if (!githubConfigured()) return Response.json({ eligible: true, connected: false, configured: false });
  const repository = approvedGitHubRepository();
  const rows = await sql`select github_login, status, granted_at, last_verified_at from github_access_grants where wallet_address = ${society.wallet.toLowerCase()} and repository = ${repository} limit 1`;
  return Response.json({ eligible: true, configured: githubConfigured(), connected: rows[0]?.status === "active", grant: rows[0] ?? null });
}
