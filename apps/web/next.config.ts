import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  transpilePackages: ["@hooded/shared", "@hooded/game-engine", "@hooded/score-service", "@hooded/ui"],
  poweredByHeader: false,
};

export default nextConfig;
