import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { SocietyAccess } from "@hooded/shared";

const SESSION_COOKIE = "hh_society_session";
const CHALLENGE_COOKIE = "hh_wallet_challenge";

type SignedPayload = { wallet: `0x${string}`; access: SocietyAccess; expiresAt: number };
type ChallengePayload = { nonce: string; expiresAt: number; origin: string };

function secret() {
  const value = process.env.SOCIETY_SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("SOCIETY_SESSION_SECRET must contain at least 32 characters");
  return value;
}

function encode(value: unknown) {
  const payload = Buffer.from(JSON.stringify(value)).toString("base64url");
  const signature = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function decode<T>(value?: string): T | null {
  if (!value) return null;
  const [payload, provided] = value.split(".");
  if (!payload || !provided) return null;
  const expected = createHmac("sha256", secret()).update(payload).digest();
  const signature = Buffer.from(provided, "base64url");
  if (signature.length !== expected.length || !timingSafeEqual(signature, expected)) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

export async function issueChallenge(origin: string) {
  const challenge: ChallengePayload = { nonce: randomBytes(24).toString("hex"), expiresAt: Date.now() + 5 * 60_000, origin };
  const cookieStore = await cookies();
  cookieStore.set(CHALLENGE_COOKIE, encode(challenge), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 300 });
  return challenge;
}

export async function readChallenge() {
  const cookieStore = await cookies();
  const challenge = decode<ChallengePayload>(cookieStore.get(CHALLENGE_COOKIE)?.value);
  if (!challenge || challenge.expiresAt < Date.now()) return null;
  return challenge;
}

export async function consumeChallenge() {
  const cookieStore = await cookies();
  cookieStore.delete(CHALLENGE_COOKIE);
}

export function challengeMessage(challenge: ChallengePayload, wallet: string) {
  return [
    "HOODED SOCIETY ACCESS",
    "Sign this message to prove wallet control. This does not authorize a transaction.",
    `Wallet: ${wallet.toLowerCase()}`,
    `Origin: ${challenge.origin}`,
    `Nonce: ${challenge.nonce}`,
    `Expires: ${new Date(challenge.expiresAt).toISOString()}`,
  ].join("\n");
}

export async function createSocietySession(payload: Omit<SignedPayload, "expiresAt">) {
  const session: SignedPayload = { ...payload, expiresAt: Date.now() + 15 * 60_000 };
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, encode(session), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 900 });
  return session;
}

export async function getSocietySession() {
  const cookieStore = await cookies();
  const session = decode<SignedPayload>(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session || session.expiresAt < Date.now()) return null;
  return session;
}
