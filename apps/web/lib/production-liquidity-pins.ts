import { getAddress, isAddress, type Address, type Hex } from "viem";

export const ROBINHOOD_MAINNET_CHAIN_ID = 4663;
export const CANONICAL_RH_WETH = "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73" as Address;
export const CANONICAL_RH_V4_POOL_MANAGER = "0x8366a39cc670b4001a1121b8f6a443a643e40951" as Address;
export const CANONICAL_RH_V4_POSITION_MANAGER = "0x58daec3116aae6d93017baaea7749052e8a04fa7" as Address;

const CODE_HASH = /^0x[a-fA-F0-9]{64}$/;

export type ProductionLiquidityPins = {
  adapterAddress: Address;
  adapterCodeHash: Hex;
  wrappedNativeCodeHash: Hex;
  poolManagerCodeHash: Hex;
  positionManagerCodeHash: Hex;
};

export type RequestedLiquidityPins = {
  liquidityAdapter: string;
  liquidityAdapterCodeHash: string;
  wrappedNativeCodeHash: string;
  poolManagerCodeHash: string;
  positionManagerCodeHash: string;
};

export function productionLiquidityPins(environment: Record<string, string | undefined>): ProductionLiquidityPins | null {
  const adapterAddress = environment.RH_V4_ADAPTER_ADDRESS;
  const adapterCodeHash = environment.RH_V4_ADAPTER_CODE_HASH;
  const wrappedNativeCodeHash = environment.RH_WETH_CODE_HASH;
  const poolManagerCodeHash = environment.RH_V4_POOL_MANAGER_CODE_HASH;
  const positionManagerCodeHash = environment.RH_V4_POSITION_MANAGER_CODE_HASH;
  if (
    !adapterAddress
      || !isAddress(adapterAddress)
      || !adapterCodeHash
      || !wrappedNativeCodeHash
      || !poolManagerCodeHash
      || !positionManagerCodeHash
      || !CODE_HASH.test(adapterCodeHash)
      || !CODE_HASH.test(wrappedNativeCodeHash)
      || !CODE_HASH.test(poolManagerCodeHash)
      || !CODE_HASH.test(positionManagerCodeHash)
  ) return null;
  return {
    adapterAddress: getAddress(adapterAddress),
    adapterCodeHash: adapterCodeHash.toLowerCase() as Hex,
    wrappedNativeCodeHash: wrappedNativeCodeHash.toLowerCase() as Hex,
    poolManagerCodeHash: poolManagerCodeHash.toLowerCase() as Hex,
    positionManagerCodeHash: positionManagerCodeHash.toLowerCase() as Hex,
  };
}

export function requestedLiquidityPinsMatch(requested: RequestedLiquidityPins, pinned: ProductionLiquidityPins) {
  return isAddress(requested.liquidityAdapter)
    && getAddress(requested.liquidityAdapter) === pinned.adapterAddress
    && requested.liquidityAdapterCodeHash.toLowerCase() === pinned.adapterCodeHash
    && requested.wrappedNativeCodeHash.toLowerCase() === pinned.wrappedNativeCodeHash
    && requested.poolManagerCodeHash.toLowerCase() === pinned.poolManagerCodeHash
    && requested.positionManagerCodeHash.toLowerCase() === pinned.positionManagerCodeHash;
}

export function isRobinhoodMainnetChain(chainId: number) {
  return chainId === ROBINHOOD_MAINNET_CHAIN_ID;
}
