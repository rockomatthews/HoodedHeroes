import { db } from "@/lib/server/database";
import { approvedGitHubRepository, revokeVerifiedHeroAccess } from "@/lib/server/github-control";
import { readWalletAccess } from "@/lib/server/onchain-access";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const sql = db();
  const grants = await sql`select wallet_address, github_login from github_access_grants where status = 'active' order by last_verified_at asc limit 50`;
  const repository = approvedGitHubRepository();
  let revoked = 0;
  for (const grant of grants) {
    const wallet = String(grant.wallet_address) as `0x${string}`;
    const access = await readWalletAccess(wallet);
    if (access.access !== "hero") {
      await revokeVerifiedHeroAccess(String(grant.github_login));
      await sql`update github_access_grants set status = 'revoked', revoked_at = now(), last_verified_at = now() where wallet_address = ${wallet} and repository = ${repository}`;
      revoked += 1;
    } else {
      await sql`update github_access_grants set last_verified_at = now() where wallet_address = ${wallet} and repository = ${repository}`;
    }
  }
  return Response.json({ checked: grants.length, revoked });
}
