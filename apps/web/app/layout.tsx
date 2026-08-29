import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://hoodedheroes.example"),
  title: "HoodedHeroes — Enter the Society",
  description: "A comic-book game and private builder society powered by $HERO on Robinhood Chain.",
  openGraph: {
    title: "HoodedHeroes — Enter the Society",
    description: "Three thousand genesis heroes. One secret builder society.",
    images: [{ url: "/og.png", width: 1536, height: 1024, alt: "HoodedHeroes comic entry portal" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "HoodedHeroes — Enter the Society",
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

