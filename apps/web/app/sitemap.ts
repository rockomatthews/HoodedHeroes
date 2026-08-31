import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "https://hooded.world";
  return [
    { url: origin, changeFrequency: "weekly", priority: 1 },
    { url: `${origin}/launch/hooded-genesis`, changeFrequency: "daily", priority: 0.9 },
  ];
}
