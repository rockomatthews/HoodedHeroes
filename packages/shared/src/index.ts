export const BRAND = {
  name: "HoodedHeroes",
  displayName: "HOODED HEROES",
  token: "$HERO",
  tagline: "ENTER THE SOCIETY. BUILD THE NEXT LEGEND.",
  chainId: 4663,
} as const;

export type HeroTier = "Recruit" | "Specialist" | "Vanguard" | "Icon";

export const HERO_TIERS = [
  { name: "Recruit", supply: 2200, price: 100_000, energy: 10, slots: 2, color: "red" },
  { name: "Specialist", supply: 600, price: 250_000, energy: 12, slots: 3, color: "blue" },
  { name: "Vanguard", supply: 180, price: 500_000, energy: 14, slots: 4, color: "green" },
  { name: "Icon", supply: 20, price: 1_000_000, energy: 16, slots: 5, color: "yellow" },
] as const;

export const RANKS = [
  { name: "Initiate", reputation: 0, days: 0, reinvest: 0, seats: null, weight: 1 },
  { name: "Operative", reputation: 100, days: 3, reinvest: 5, seats: null, weight: 1.3 },
  { name: "Sentinel", reputation: 300, days: 7, reinvest: 8, seats: null, weight: 1.7 },
  { name: "Champion", reputation: 750, days: 14, reinvest: 10, seats: 540, weight: 2.2 },
  { name: "Paragon", reputation: 1600, days: 21, reinvest: 14, seats: 215, weight: 2.9 },
  { name: "Titan", reputation: 3200, days: 30, reinvest: 18, seats: 80, weight: 3.7 },
  { name: "Luminary", reputation: 6000, days: 45, reinvest: 22, seats: 23, weight: 4.7 },
  { name: "Legend", reputation: 10_000, days: 60, reinvest: 25, seats: 15, weight: 6 },
] as const;

export const HOUSES = [
  { name: "Crimson Veil", ticker: "AAPL", color: "red", score: 12_850 },
  { name: "Azure Coven", ticker: "NVDA", color: "blue", score: 11_230 },
  { name: "Emerald Circle", ticker: "MSFT", color: "green", score: 10_540 },
  { name: "Golden Alliance", ticker: "GOOGL", color: "yellow", score: 9_870 },
  { name: "Violet Syndicate", ticker: "AMZN", color: "violet", score: 8_910 },
  { name: "Ember Order", ticker: "TSLA", color: "orange", score: 7_650 },
] as const;

export const MISSIONS = [
  { id: "power-grid", name: "Power Grid", status: "live", reward: 120 },
  { id: "drone-dash", name: "Drone Dash", status: "next", reward: 90 },
  { id: "cipher-break", name: "Cipher Break", status: "next", reward: 100 },
  { id: "rescue-chain", name: "Rescue Chain", status: "planned", reward: 140 },
  { id: "meteor-reflex", name: "Meteor Reflex", status: "planned", reward: 110 },
  { id: "skyline-stack", name: "Skyline Stack", status: "planned", reward: 130 },
] as const;
