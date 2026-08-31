export const HOODED_PREVIEW_THRESHOLD = 25_000n * 10n ** 18n;

export type SocietyAccess = "vestibule" | "preview" | "hero";

export type AccessEvidence = {
  hoodedBalance: bigint;
  genesisHeroBalance: bigint;
};

export function evaluateSocietyAccess(evidence: AccessEvidence): SocietyAccess {
  if (evidence.genesisHeroBalance > 0n) return "hero";
  if (evidence.hoodedBalance >= HOODED_PREVIEW_THRESHOLD) return "preview";
  return "vestibule";
}

export function canUseBuilder(access: SocietyAccess) {
  return access === "hero";
}
