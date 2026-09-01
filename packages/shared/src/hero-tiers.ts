export type HeroTier = "Recruit" | "Specialist" | "Vanguard" | "Icon";

export const FOUNDER_HERO_GRANT = 10 as const;

export const HERO_TIERS = [
  { name: "Recruit", supply: 2200, publicSupply: 2190, founderSupply: 10, price: 100_000, energy: 10, slots: 2, color: "red" },
  { name: "Specialist", supply: 600, publicSupply: 600, founderSupply: 0, price: 250_000, energy: 12, slots: 3, color: "blue" },
  { name: "Vanguard", supply: 180, publicSupply: 180, founderSupply: 0, price: 500_000, energy: 14, slots: 4, color: "green" },
  { name: "Icon", supply: 20, publicSupply: 20, founderSupply: 0, price: 1_000_000, energy: 16, slots: 5, color: "yellow" },
] as const;
