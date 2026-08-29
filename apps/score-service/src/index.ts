import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createRound, scorePath, validatePath, type Cell } from "@hoodedheroes/game-engine";

export type ScoreSession = { wallet: string; seed: number; nonce: string; issuedAt: number; expiresAt: number };
export type SignedSession = { session: ScoreSession; signature: string };

function payload(session: ScoreSession) {
  return [session.wallet.toLowerCase(), session.seed, session.nonce, session.issuedAt, session.expiresAt].join(":");
}

function signatureFor(session: ScoreSession, secret: string) {
  return createHmac("sha256", secret).update(payload(session)).digest("hex");
}

export function issueScoreSession(wallet: string, secret: string, now = Date.now()): SignedSession {
  if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) throw new Error("Invalid wallet address");
  const session = { wallet: wallet.toLowerCase(), seed: randomBytes(4).readUInt32BE(0), nonce: randomBytes(16).toString("hex"), issuedAt: now, expiresAt: now + 5 * 60_000 };
  return { session, signature: signatureFor(session, secret) };
}

export function verifyScore(input: SignedSession & { round: number; path: Cell[]; elapsedMs: number; combo: number }, secret: string, now = Date.now()) {
  const expected = Buffer.from(signatureFor(input.session, secret), "hex");
  const supplied = Buffer.from(input.signature, "hex");
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) throw new Error("Invalid session signature");
  if (now > input.session.expiresAt || now < input.session.issuedAt) throw new Error("Expired score session");
  if (!Number.isInteger(input.round) || input.round < 0 || input.round > 20) throw new Error("Invalid round");
  if (!Number.isFinite(input.elapsedMs) || input.elapsedMs < 250 || input.elapsedMs > 30_000) throw new Error("Invalid elapsed time");
  const round = createRound(input.session.seed, input.round);
  if (!validatePath(input.path, round)) throw new Error("Invalid action trace");
  return { score: scorePath(input.path, input.elapsedMs, input.combo), nonce: input.session.nonce, traceHash: createHmac("sha256", secret).update(JSON.stringify(input.path)).digest("hex") };
}

// Persistence adapters must atomically reserve this nonce before crediting a score.
export function replayKey(session: ScoreSession) { return `score-nonce:${session.nonce}`; }
