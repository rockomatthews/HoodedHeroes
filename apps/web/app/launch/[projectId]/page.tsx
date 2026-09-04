import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
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
    openGraph: { title: `${launch.metadata.name} // ${launch.metadata.symbol}`, description: launch.metadata.publication.summary, type: "website", images: [{ url: "/launch-assets/hooded/og-1200x630.png", width: 1200, height: 630, alt: `${launch.metadata.name} HOODED launch` }] },
    twitter: { card: "summary_large_image", title: `${launch.metadata.name} // ${launch.metadata.symbol}`, description: launch.metadata.publication.summary, images: ["/launch-assets/hooded/og-1200x630.png"] },
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
    ["Community grants", launch.sale.creatorAllocationBps],
  ] as const;
  const tokenSupply = BigInt(launch.metadata.exactSupply) / 10n ** BigInt(launch.metadata.decimals);
  const isLab = launch.launchClass === "lab";
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
          <div className="public-token-emblem"><Image src="/launch-assets/hooded/icon-512.png" alt="HOODED token emblem" width={512} height={512} /></div>
          <div><small>ROBINHOOD CHAIN // {isLab ? "EXPERIMENTAL LAB" : "FIXED SUPPLY"}</small><h1>{projectId === "hooded-genesis" ? "HOODED" : launch.metadata.name}</h1><h2>${launch.metadata.symbol}</h2><p>{launch.metadata.publication.summary}</p></div>
          <aside><span>STATUS</span><strong>{isLab ? "NO VALUE LAB" : "GENESIS PACKAGE"}</strong><small>{launch.lifecycle.toUpperCase().replaceAll("-", " ")}</small></aside>
        </div>
        <div className="public-launch-grid">
          <section><h3>{isLab ? "ONE MILLION LAB UNITS" : "ONE BILLION. NO MORE."}</h3><div className="supply-number">{tokenSupply.toLocaleString("en-US")}</div><p>No future mint, freeze, blacklist, transfer tax, or arbitrary upgrade authority.</p><div className="authority-stamps"><b>FIXED</b><b>AGPL</b><b>PRO-RATA</b><b>{isLab ? "NO PUBLIC LP" : "LOCKED LP"}</b></div></section>
          <section><h3>GENESIS DISTRIBUTION</h3>{allocations.map(([label, bps]) => <div className="allocation-row" key={label}><span>{label}</span><i><b style={{ width: `${bps / 100}%` }} /></i><strong>{bps / 100}%</strong></div>)}</section>
          <section id="genesis-heroes"><h3>{isLab ? "LAB EVIDENCE SEQUENCE" : "THE ACCESS SEQUENCE"}</h3><ol>{isLab ? <><li><b>01</b><span>Owner-only sealed deployment</span></li><li><b>02</b><span>Source and metadata verification</span></li><li><b>03</b><span>No public liquidity or promotion</span></li><li><b>04</b><span>Permanent retirement evidence</span></li></> : <><li><b>01</b><span>Audits, legal controls, local tests, and mainnet-fork exercises</span></li><li><b>02</b><span>Safe-approved sealed mainnet creation</span></li><li><b>03</b><span>72-hour pro-rata activation after verified readback</span></li><li><b>04</b><span>25,000 HOODED reveals the second seal</span></li><li><b>05</b><span>One Genesis Hero unlocks the private Society</span></li></>}</ol></section>
        </div>
        <footer className="public-launch-footer"><p>{launch.metadata.publication.riskDisclosure}</p><button disabled>CONTRIBUTIONS NOT OPEN</button></footer>
      </section>
    </main>
  );
}
