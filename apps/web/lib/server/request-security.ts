import "server-only";

import { databaseConfigured, db } from "./database";

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host || new URL(origin).host !== host) throw new Response("Invalid request origin", { status: 403 });
}

export function requireIdempotencyKey(request: Request) {
  const key = request.headers.get("idempotency-key");
  if (!key || !/^[A-Za-z0-9_-]{16,128}$/.test(key)) throw new Response("A valid Idempotency-Key header is required", { status: 400 });
  return key;
}

export async function requireDatabaseRateLimit(scope: string, subject: string, limit: number, windowSeconds: number) {
  if (!databaseConfigured()) throw new Response("PostgreSQL is required for rate-limited mutations", { status: 503 });
  const bucketMs = windowSeconds * 1_000;
  const bucketStart = new Date(Math.floor(Date.now() / bucketMs) * bucketMs);
  const sql = db();
  const rows = await sql`insert into api_rate_limits (scope, subject, bucket_start, request_count) values (${scope}, ${subject.toLowerCase()}, ${bucketStart}, 1) on conflict (scope, subject, bucket_start) do update set request_count = api_rate_limits.request_count + 1 returning request_count`;
  if (Number(rows[0]?.request_count ?? limit + 1) > limit) throw new Response("Rate limit exceeded", { status: 429, headers: { "Retry-After": String(windowSeconds) } });
}

export function publicError(error: unknown) {
  if (error instanceof Response) return error;
  const message = error instanceof Error ? error.message : "Unexpected server error";
  const safe = /configured|authentication|access|expired|not found|invalid|disabled/i.test(message) ? message : "The operation could not be completed";
  return Response.json({ error: safe }, { status: 500 });
}
