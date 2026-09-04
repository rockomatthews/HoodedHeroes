import { z } from "zod";
import { challengeMessage, issueChallenge } from "@/lib/server/session";
import { accessConfigurationReady } from "@/lib/server/onchain-access";
import { assertSameOrigin, publicError } from "@/lib/server/request-security";

export const runtime = "nodejs";
const bodySchema = z.object({ wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/) });

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    if (!accessConfigurationReady()) return Response.json({ error: "Robinhood Chain gate is not configured", configured: false }, { status: 503 });
    const { wallet } = bodySchema.parse(await request.json());
    const origin = new URL(request.url).origin;
    const challenge = await issueChallenge(origin);
    return Response.json({ message: challengeMessage(challenge, wallet), expiresAt: challenge.expiresAt, configured: true });
  } catch (error) {
    return publicError(error);
  }
}
