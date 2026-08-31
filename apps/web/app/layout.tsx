import type { Metadata } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://hooded.world";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "HOODED — Enter the Society",
  description: "A comic-book game and private builder society powered by $HOODED on Robinhood Chain.",
  openGraph: {
    title: "HOODED — Enter the Society",
    description: "Three thousand genesis heroes. One secret builder society.",
    images: [{ url: "/og.png", width: 1536, height: 1024, alt: "HOODED comic entry portal" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "HOODED — Enter the Society",
    description: "Three thousand genesis heroes. One secret builder society.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
