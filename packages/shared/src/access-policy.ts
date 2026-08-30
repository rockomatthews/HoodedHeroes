export const HERO_PREVIEW_THRESHOLD = 25_000n * 10n ** 18n;

export type SocietyAccess = "vestibule" | "preview" | "hero";

export type AccessEvidence = {
  heroBalance: bigint;
  genesisHeroBalance: bigint;
};

export function evaluateSocietyAccess(evidence: AccessEvidence): SocietyAccess {
  if (evidence.genesisHeroBalance > 0n) return "hero";
  if (evidence.heroBalance >= HERO_PREVIEW_THRESHOLD) return "preview";
  return "vestibule";
}

export function canUseBuilder(access: SocietyAccess) {
  return access === "hero";
}
