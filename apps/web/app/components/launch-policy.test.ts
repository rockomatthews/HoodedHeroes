import { describe, expect, it } from "vitest";
import { DEFAULT_LAUNCH_PROPOSAL, validateLaunchProposal } from "@hooded/shared";

describe("HOODED Launch Bay policy", () => {
  it("accepts the audited fixed-supply template defaults", () => {
    const result = validateLaunchProposal(DEFAULT_LAUNCH_PROPOSAL);
    expect(result.ready).toBe(true);
    expect(result.passed).toBe(result.total);
  });

  it("rejects excess creator allocation and short vesting", () => {
    const result = validateLaunchProposal({ ...DEFAULT_LAUNCH_PROPOSAL, creatorAllocationBps: 1200, vestingMonths: 6 });
    expect(result.ready).toBe(false);
    expect(result.checks.find((check) => check.id === "creator")?.passed).toBe(false);
    expect(result.checks.find((check) => check.id === "vesting")?.passed).toBe(false);
  });

  it("rejects mutable taxes, hidden minting, and unlocked liquidity", () => {
    const result = validateLaunchProposal({ ...DEFAULT_LAUNCH_PROPOSAL, transferTaxBps: 100, hiddenMint: true, liquidityLocked: false });
    expect(result.ready).toBe(false);
    expect(result.checks.filter((check) => !check.passed).map((check) => check.id)).toEqual(expect.arrayContaining(["liquidity", "transfer", "control"]));
  });
});
