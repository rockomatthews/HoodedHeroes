import { describe, expect, it } from "vitest";
import { createRound } from "@hoodedheroes/game-engine";
import { issueScoreSession, replayKey, verifyScore } from "./index";

const secret = "test-secret-at-least-32-characters-long";
const wallet = "0x0000000000000000000000000000000000000042";

describe("signed score sessions", () => {
  it("rejects tampered seeds", () => {
    const signed = issueScoreSession(wallet, secret, 1000);
    signed.session.seed += 1;
    expect(() => verifyScore({ ...signed, round: 0, path: [], elapsedMs: 1000, combo: 1 }, secret, 2000)).toThrow("Invalid session signature");
  });
  it("provides a stable replay-prevention key", () => {
    const signed = issueScoreSession(wallet, secret, 1000);
    expect(replayKey(signed.session)).toBe(`score-nonce:${signed.session.nonce}`);
  });
  it("rejects traces that do not reach the deterministic target", () => {
    const signed = issueScoreSession(wallet, secret, 1000);
    const round = createRound(signed.session.seed, 0);
    expect(() => verifyScore({ ...signed, round: 0, path: [round.start], elapsedMs: 1000, combo: 1 }, secret, 2000)).toThrow("Invalid action trace");
  });
});
