import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "https://hoodedheroes.example";
  return { rules: { userAgent: "*", allow: ["/", "/launch/"], disallow: ["/api/", "/_next/"] }, sitemap: `${origin}/sitemap.xml` };
}
