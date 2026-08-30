import "server-only";

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

export function publicError(error: unknown) {
  if (error instanceof Response) return error;
  const message = error instanceof Error ? error.message : "Unexpected server error";
  const safe = /configured|authentication|access|expired|not found|invalid|disabled/i.test(message) ? message : "The operation could not be completed";
  return Response.json({ error: safe }, { status: 500 });
}
