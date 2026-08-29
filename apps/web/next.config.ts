import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  transpilePackages: ["@hoodedheroes/shared", "@hoodedheroes/game-engine", "@hoodedheroes/score-service", "@hoodedheroes/ui"],
  poweredByHeader: false,
};

export default nextConfig;
