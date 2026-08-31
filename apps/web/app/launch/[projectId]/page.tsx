import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicLaunch } from "@/lib/server/public-launch";

type Props = { params: Promise<{ projectId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { projectId } = await params;
  const launch = await getPublicLaunch(projectId);
  if (!launch) return { title: "Launch not found" };
  return {
    title: `${launch.metadata.name} (${launch.metadata.symbol}) — HOODED Launch Bay`,
    description: launch.metadata.publication.summary,
    alternates: { canonical: launch.metadata.canonicalLaunchUrl },
    openGraph: { title: `${launch.metadata.name} // ${launch.metadata.symbol}`, description: launch.metadata.publication.summary, type: "website", images: [{ url: "/og.png", width: 1200, height: 630, alt: `${launch.metadata.name} HOODED launch` }] },
    twitter: { card: "summary_large_image", title: `${launch.metadata.name} // ${launch.metadata.symbol}`, description: launch.metadata.publication.summary, images: ["/og.png"] },
  };
}

export default async function PublicLaunchPage({ params }: Props) {
  const { projectId } = await params;
  const launch = await getPublicLaunch(projectId);
  if (!launch) notFound();
  const allocations = [
    ["Public fair launch", launch.sale.saleAllocationBps],
    ["Game + seasonal rewards", launch.sale.rewardsAllocationBps],
    ["Permanently locked liquidity", launch.sale.liquidityAllocationBps],
    ["Timelocked DAO", launch.sale.treasuryAllocationBps],
    ["Vested contributors", launch.sale.creatorAllocationBps],
  ] as const;
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: `${launch.metadata.name} token launch`,
    description: launch.metadata.publication.summary,
    url: launch.metadata.canonicalLaunchUrl,
    isPartOf: { "@type": "WebSite", name: "HOODED" },
  };

  return (
    <main className="public-launch-shell">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replaceAll("<", "\\u003c") }} />
      <section className="public-launch-card">
        <header className="public-launch-header"><Link href="/" aria-label="Return to HOODED">← HQ</Link><span>LAUNCH BAY // PUBLIC VESTIBULE</span><b>{launch.environment.toUpperCase()}</b></header>
        <div className="public-launch-hero">
          <div className="public-token-emblem"><i>H</i></div>
          <div><small>ROBINHOOD CHAIN // FIXED SUPPLY</small><h1>{projectId === "hooded-genesis" ? "HOODED" : launch.metadata.name}</h1><h2>${launch.metadata.symbol}</h2><p>{launch.metadata.publication.summary}</p></div>
          <aside><span>STATUS</span><strong>GENESIS PACKAGE</strong><small>SALE CLOSED // AUDIT REQUIRED</small></aside>
        </div>
        <div className="public-launch-grid">
          <section><h3>ONE BILLION. NO MORE.</h3><div className="supply-number">1,000,000,000</div><p>No future mint, freeze, blacklist, transfer tax, or arbitrary upgrade authority.</p><div className="authority-stamps"><b>FIXED</b><b>AGPL</b><b>PRO-RATA</b><b>LOCKED LP</b></div></section>
          <section><h3>GENESIS DISTRIBUTION</h3>{allocations.map(([label, bps]) => <div className="allocation-row" key={label}><span>{label}</span><i><b style={{ width: `${bps / 100}%` }} /></i><strong>{bps / 100}%</strong></div>)}</section>
          <section><h3>THE ACCESS SEQUENCE</h3><ol><li><b>01</b><span>Audits, legal controls, and testnet exercises</span></li><li><b>02</b><span>Public vestibule fair-launch window</span></li><li><b>03</b><span>25,000 HOODED unlocks society preview</span></li><li><b>04</b><span>A Genesis Hero unlocks builder access</span></li></ol></section>
        </div>
        <footer className="public-launch-footer"><p>{launch.metadata.publication.riskDisclosure}</p><button disabled>CONTRIBUTIONS NOT OPEN</button></footer>
      </section>
    </main>
  );
}
