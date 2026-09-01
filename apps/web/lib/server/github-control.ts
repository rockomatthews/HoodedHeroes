import "server-only";

import { createSign } from "node:crypto";

const GITHUB_API = "https://api.github.com";

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export function approvedGitHubRepository() {
  const repository = required("GITHUB_REPOSITORY");
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) throw new Error("GITHUB_REPOSITORY is invalid");
  return repository;
}

function base64url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function appJwt() {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify({ iat: now - 30, exp: now + 540, iss: required("GITHUB_APP_ID") }));
  const unsigned = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  const key = required("GITHUB_APP_PRIVATE_KEY").replaceAll("\\n", "\n");
  return `${unsigned}.${signer.sign(key).toString("base64url")}`;
}

async function github<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: {
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      authorization: `Bearer ${token ?? await installationToken()}`,
      ...init.headers,
    },
  });
  if (!response.ok) throw new Error(`GitHub request failed (${response.status})`);
  return response.status === 204 ? undefined as T : await response.json() as T;
}

export function githubConfigured() {
  return Boolean(
    process.env.GITHUB_APP_ID
    && process.env.GITHUB_APP_PRIVATE_KEY
    && process.env.GITHUB_APP_INSTALLATION_ID
    && process.env.GITHUB_OAUTH_CLIENT_ID
    && process.env.GITHUB_OAUTH_CLIENT_SECRET
    && process.env.GITHUB_ORG
    && process.env.GITHUB_TEAM_SLUG
    && process.env.GITHUB_REPOSITORY,
  );
}

export async function installationToken() {
  const result = await github<{ token: string }>(
    `/app/installations/${required("GITHUB_APP_INSTALLATION_ID")}/access_tokens`,
    { method: "POST" },
    appJwt(),
  );
  return result.token;
}

export function githubOAuthUrl(state: string) {
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", required("GITHUB_OAUTH_CLIENT_ID"));
  url.searchParams.set("redirect_uri", `${required("NEXT_PUBLIC_SITE_URL")}/api/github/callback`);
  url.searchParams.set("scope", "read:user user:email");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeGitHubCode(code: string) {
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({
      client_id: required("GITHUB_OAUTH_CLIENT_ID"),
      client_secret: required("GITHUB_OAUTH_CLIENT_SECRET"),
      code,
    }),
  });
  const token = await response.json() as { access_token?: string; error?: string };
  if (!response.ok || !token.access_token) throw new Error(token.error ?? "GitHub authentication failed");
  return github<{ id: number; login: string; avatar_url: string }>("/user", {}, token.access_token);
}

export async function grantVerifiedHeroAccess(username: string) {
  const org = required("GITHUB_ORG");
  const team = required("GITHUB_TEAM_SLUG");
  await github(`/orgs/${encodeURIComponent(org)}/teams/${encodeURIComponent(team)}/memberships/${encodeURIComponent(username)}`, {
    method: "PUT",
    body: JSON.stringify({ role: "member" }),
  });
}

export async function revokeVerifiedHeroAccess(username: string) {
  const org = required("GITHUB_ORG");
  const team = required("GITHUB_TEAM_SLUG");
  await github(`/orgs/${encodeURIComponent(org)}/teams/${encodeURIComponent(team)}/memberships/${encodeURIComponent(username)}`, { method: "DELETE" });
}

export async function downloadApprovedSource(ref: string) {
  if (!/^[a-fA-F0-9]{40}$/.test(ref)) throw new Error("Invalid approved source commit");
  const token = await installationToken();
  return fetch(`${GITHUB_API}/repos/${approvedGitHubRepository()}/zipball/${ref}`, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": "2022-11-28",
    },
    redirect: "follow",
  });
}

export async function createProposalPullRequest(input: { branch: string; title: string; body: string }) {
  if (!/^codex\/[a-z0-9][a-z0-9-]{2,60}$/.test(input.branch)) throw new Error("Invalid proposal branch");
  return github<{ html_url: string; number: number }>(`/repos/${approvedGitHubRepository()}/pulls`, {
    method: "POST",
    body: JSON.stringify({ title: input.title, body: input.body, head: input.branch, base: "main", maintainer_can_modify: false }),
  });
}
