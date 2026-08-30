import { issueChallenge } from "@/lib/server/session";
import { accessConfigurationReady } from "@/lib/server/onchain-access";
import { assertSameOrigin, publicError } from "@/lib/server/request-security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    if (!accessConfigurationReady()) return Response.json({ error: "Robinhood Chain gate is not configured", configured: false }, { status: 503 });
    const origin = new URL(request.url).origin;
    const challenge = await issueChallenge(origin);
    return Response.json({ nonce: challenge.nonce, expiresAt: challenge.expiresAt, configured: true });
  } catch (error) {
    return publicError(error);
  }
}
