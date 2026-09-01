import "server-only";

import { getAddress, isAddress, type Address } from "viem";

export function configuredCanaryOwner(): Address | null {
  const value = process.env.LAUNCH_CANARY_OWNER_ADDRESS;
  return value && isAddress(value) ? getAddress(value) : null;
}

export function isLaunchCanaryOwner(wallet: string) {
  const owner = configuredCanaryOwner();
  return Boolean(owner && isAddress(wallet) && getAddress(wallet) === owner);
}

export function canaryModeEnabled() {
  return process.env.ENABLE_MAINNET_CANARY === "true";
}
