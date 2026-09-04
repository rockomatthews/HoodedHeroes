import { describe, expect, it } from "vitest";
import { isRobinhoodMainnetChain, productionLiquidityPins, requestedLiquidityPinsMatch } from "./production-liquidity-pins";

const adapter = "0x1111111111111111111111111111111111111111";
const hashes = {
  RH_V4_ADAPTER_CODE_HASH: `0x${"11".repeat(32)}`,
  RH_WETH_CODE_HASH: `0x${"22".repeat(32)}`,
  RH_V4_POOL_MANAGER_CODE_HASH: `0x${"33".repeat(32)}`,
  RH_V4_POSITION_MANAGER_CODE_HASH: `0x${"44".repeat(32)}`,
};

describe("production liquidity pins", () => {
  it("requires all server-owned addresses and code hashes", () => {
    expect(productionLiquidityPins({ RH_V4_ADAPTER_ADDRESS: adapter, ...hashes })).toEqual({
      adapterAddress: adapter,
      adapterCodeHash: hashes.RH_V4_ADAPTER_CODE_HASH,
      wrappedNativeCodeHash: hashes.RH_WETH_CODE_HASH,
      poolManagerCodeHash: hashes.RH_V4_POOL_MANAGER_CODE_HASH,
      positionManagerCodeHash: hashes.RH_V4_POSITION_MANAGER_CODE_HASH,
    });
    expect(productionLiquidityPins({ RH_V4_ADAPTER_ADDRESS: adapter, ...hashes, RH_WETH_CODE_HASH: undefined })).toBeNull();
    expect(productionLiquidityPins({ RH_V4_ADAPTER_ADDRESS: adapter, ...hashes, RH_V4_ADAPTER_CODE_HASH: "0x12" })).toBeNull();
  });

  it("rejects caller-selected adapter generations and caller-selected hashes", () => {
    const pinned = productionLiquidityPins({ RH_V4_ADAPTER_ADDRESS: adapter, ...hashes });
    expect(pinned).not.toBeNull();
    const requested = {
      liquidityAdapter: adapter,
      liquidityAdapterCodeHash: hashes.RH_V4_ADAPTER_CODE_HASH,
      wrappedNativeCodeHash: hashes.RH_WETH_CODE_HASH,
      poolManagerCodeHash: hashes.RH_V4_POOL_MANAGER_CODE_HASH,
      positionManagerCodeHash: hashes.RH_V4_POSITION_MANAGER_CODE_HASH,
    };
    expect(requestedLiquidityPinsMatch(requested, pinned!)).toBe(true);
    expect(requestedLiquidityPinsMatch({ ...requested, liquidityAdapter: "0x2222222222222222222222222222222222222222" }, pinned!)).toBe(false);
    expect(requestedLiquidityPinsMatch({ ...requested, poolManagerCodeHash: `0x${"aa".repeat(32)}` }, pinned!)).toBe(false);
  });

  it("accepts only Robinhood Chain mainnet", () => {
    expect(isRobinhoodMainnetChain(4663)).toBe(true);
    expect(isRobinhoodMainnetChain(1)).toBe(false);
    expect(isRobinhoodMainnetChain(8453)).toBe(false);
  });
});
