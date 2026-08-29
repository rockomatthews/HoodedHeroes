import { describe, expect, it } from "vitest";
import { createRound, isAdjacent, scorePath, validatePath } from "./index";

describe("Power Grid engine", () => {
  it("creates reproducible rounds", () => {
    expect(createRound(42, 3)).toEqual(createRound(42, 3));
  });

  it("recognizes adjacent cells", () => {
    expect(isAdjacent({ x: 1, y: 1 }, { x: 2, y: 1 })).toBe(true);
    expect(isAdjacent({ x: 1, y: 1 }, { x: 2, y: 2 })).toBe(false);
  });

  it("rejects a path that jumps directly to the target", () => {
    const round = createRound(12, 0);
    expect(validatePath([round.start, round.target], round)).toBe(false);
  });

  it("rewards fast, efficient routes", () => {
    expect(scorePath(Array.from({ length: 8 }, (_, x) => ({ x, y: 0 })), 5_000, 2)).toBeGreaterThan(
      scorePath(Array.from({ length: 15 }, (_, x) => ({ x, y: 0 })), 15_000, 1),
    );
  });
});
