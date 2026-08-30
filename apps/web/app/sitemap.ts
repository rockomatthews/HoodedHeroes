import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "https://hoodedheroes.example";
  return [
    { url: origin, changeFrequency: "weekly", priority: 1 },
    { url: `${origin}/launch/hoodedheroes-hero-genesis`, changeFrequency: "daily", priority: 0.9 },
  ];
}
