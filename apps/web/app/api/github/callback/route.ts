import { cookies } from "next/headers";
import { databaseConfigured, db } from "@/lib/server/database";
import { approvedGitHubRepository, exchangeGitHubCode, grantVerifiedHeroAccess } from "@/lib/server/github-control";
import { getSocietySession } from "@/lib/server/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const cookieStore = await cookies();
  const expected = cookieStore.get("hooded_github_state")?.value;
  cookieStore.delete("hooded_github_state");
  const society = await getSocietySession();
  if (!society || society.access !== "hero" || !state || !code || state !== expected) return Response.redirect(new URL("/?github=denied", request.url));
  if (!databaseConfigured()) return Response.redirect(new URL("/?github=database", request.url));
  try {
    const account = await exchangeGitHubCode(code);
    await grantVerifiedHeroAccess(account.login);
    const sql = db();
    const repository = approvedGitHubRepository();
    await sql`insert into github_accounts (wallet_address, github_user_id, github_login, avatar_url, linked_at, last_verified_at) values (${society.wallet.toLowerCase()}, ${account.id}, ${account.login}, ${account.avatar_url}, now(), now()) on conflict (wallet_address) do update set github_user_id = excluded.github_user_id, github_login = excluded.github_login, avatar_url = excluded.avatar_url, last_verified_at = now()`;
    await sql`insert into github_access_grants (wallet_address, repository, github_login, status, granted_at, last_verified_at) values (${society.wallet.toLowerCase()}, ${repository}, ${account.login}, 'active', now(), now()) on conflict (wallet_address, repository) do update set github_login = excluded.github_login, status = 'active', granted_at = now(), revoked_at = null, last_verified_at = now()`;
    return Response.redirect(new URL("/?github=connected", request.url));
  } catch {
    return Response.redirect(new URL("/?github=failed", request.url));
  }
}
