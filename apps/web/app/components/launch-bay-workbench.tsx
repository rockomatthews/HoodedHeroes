"use client";

import { useMemo, useState } from "react";
import { HERO_GENESIS_MANIFEST, buildDexScreenerProfile, buildMetaplexMetadata, buildUniswapTokenList, simulateProRataLaunch, validateLaunchManifest, type LaunchChain, type LaunchManifestV1 } from "@hoodedheroes/shared";

const CHAINS: { id: LaunchChain; label: string; status: string; color: string }[] = [
  { id: "robinhood", label: "RH CHAIN", status: "EVM TESTNET", color: "green" },
  { id: "base", label: "BASE", status: "EVM TESTNET", color: "blue" },
  { id: "solana", label: "SOLANA", status: "ADAPTER PREVIEW", color: "purple" },
];

function initialManifest(): LaunchManifestV1 {
  const manifest = JSON.parse(JSON.stringify(HERO_GENESIS_MANIFEST)) as LaunchManifestV1;
  manifest.metadata.projectId = "night-signal-testnet";
  manifest.metadata.name = "Night Signal";
  manifest.metadata.symbol = "SIGNAL";
  manifest.metadata.publication.summary = "A community-built signal token launched through the HoodedHeroes society.";
  manifest.metadata.publication.description = "Night Signal demonstrates fixed supply, pro-rata allocation, versioned metadata, transparent fees, and permanently locked liquidity.";
  manifest.metadata.publication.utility = "Community coordination and testnet launch-system validation.";
  return manifest;
}

export function LaunchBayWorkbench() {
  const [manifest, setManifest] = useState(initialManifest);
  const [submitted, setSubmitted] = useState(false);
  const [view, setView] = useState<"audit" | "metadata" | "simulation">("audit");
  const validation = useMemo(() => validateLaunchManifest(manifest), [manifest]);
  const simulation = useMemo(() => simulateProRataLaunch({ saleTokenAllocation: 400_000_000n, maximumRaise: 100_000n, contributions: [{ wallet: "CRIMSON", amount: 80_000n }, { wallet: "AZURE", amount: 50_000n }, { wallet: "EMERALD", amount: 30_000n }] }), []);

  function updateMetadata<Key extends keyof LaunchManifestV1["metadata"]>(key: Key, value: LaunchManifestV1["metadata"][Key]) {
    setSubmitted(false);
    setManifest((current) => ({ ...current, metadata: { ...current.metadata, [key]: value } }));
  }
  function updatePublication<Key extends keyof LaunchManifestV1["metadata"]["publication"]>(key: Key, value: LaunchManifestV1["metadata"]["publication"][Key]) {
    setSubmitted(false);
    setManifest((current) => ({ ...current, metadata: { ...current.metadata, publication: { ...current.metadata.publication, [key]: value } } }));
  }
  function selectChain(chain: LaunchChain) {
    const quoteAsset = chain === "solana" ? "SOL" : "ETH";
    const venue = chain === "solana" ? "raydium-cpmm" : "uniswap-v4";
    setSubmitted(false);
    setManifest((current) => ({ ...current, metadata: { ...current.metadata, chain }, sale: { ...current.sale, quoteAsset }, liquidity: { venue, permanentlyLocked: true } } as LaunchManifestV1));
  }

  const chainId = manifest.metadata.chain === "robinhood" ? 46630 : 84532;
  const distributionPreview = manifest.metadata.chain === "solana" ? buildMetaplexMetadata(manifest.metadata) : manifest.metadata.tokenAddress ? buildUniswapTokenList(manifest.metadata, chainId) : { tokenList: "Generated after deterministic contract address is prepared", dexScreener: "Profile package staged after deployment" };
  const dexPreview = manifest.metadata.tokenAddress ? buildDexScreenerProfile(manifest.metadata) : null;

  return (
    <div className="launch-builder launch-builder--v1">
      <div className="chain-selector">{CHAINS.map((chain) => <button key={chain.id} className={`${manifest.metadata.chain === chain.id ? "is-active" : ""} chain-${chain.color}`} onClick={() => selectChain(chain.id)}><b>{chain.label}</b><small>{chain.status}</small></button>)}</div>
      <div className="launch-builder-grid">
        <div className="launch-form launch-form--manifest">
          <div className="launch-field launch-field--wide"><label>Project name<input aria-label="Project name" value={manifest.metadata.name} onChange={(event) => updateMetadata("name", event.target.value)} /></label><label>Symbol<input aria-label="Token symbol" value={manifest.metadata.symbol} maxLength={10} onChange={(event) => updateMetadata("symbol", event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} /></label></div>
          <div className="launch-field launch-field--wide"><label>Exact fixed supply<input aria-label="Fixed supply" value={manifest.metadata.exactSupply} onChange={(event) => updateMetadata("exactSupply", event.target.value.replace(/\D/g, ""))} /></label><label>Quote asset<input aria-label="Quote asset" value={manifest.sale.quoteAsset} readOnly /></label></div>
          <div className="launch-field"><label>Discovery summary<input aria-label="Discovery summary" value={manifest.metadata.publication.summary} onChange={(event) => updatePublication("summary", event.target.value)} /></label></div>
          <div className="allocation-cards"><span><b>40%</b> FAIR LAUNCH</span><span><b>30%</b> REWARDS</span><span><b>15%</b> LOCKED LP</span><span><b>10%</b> DAO</span><span><b>5%</b> VESTED</span></div>
          <div className="launch-terms"><span>PRO-RATA WINDOW</span><span>0.75% FEE</span><span>1% HARD CAP</span><span>NO ADMIN WITHDRAW</span></div>
        </div>
        <div className="launch-audit launch-audit--tabs">
          <div className="launch-view-tabs"><button className={view === "audit" ? "is-active" : ""} onClick={() => setView("audit")}>12 GATES</button><button className={view === "metadata" ? "is-active" : ""} onClick={() => setView("metadata")}>METADATA</button><button className={view === "simulation" ? "is-active" : ""} onClick={() => setView("simulation")}>SIM</button></div>
          {view === "audit" && <><div className="launch-score"><span>MANIFEST READINESS</span><strong>{validation.passed}/{validation.total}</strong><b className={validation.ready ? "is-ready" : "is-blocked"}>{validation.ready ? "TESTNET REVIEW READY" : "BLOCKED"}</b></div><div className="launch-checks launch-checks--dense">{validation.checks.map((check) => <div key={check.id} className={check.passed ? "is-pass" : "is-fail"} title={check.detail}><i>{check.passed ? "✓" : "×"}</i><span>{check.label}</span></div>)}</div></>}
          {view === "metadata" && <div className="metadata-preview"><b>MAX-EXPOSURE PACKAGE</b><p>Metaplex · Uniswap List · Blockscout · DEX Screener · CoinGecko · OG 1200×630</p><pre>{JSON.stringify(distributionPreview, null, 2).slice(0, 600)}</pre>{dexPreview && <small>DEX profile ready</small>}</div>}
          {view === "simulation" && <div className="simulation-preview"><b>OVERSUBSCRIBED // SAME PRICE</b>{simulation.wallets.map((wallet) => <div key={wallet.wallet}><span>{wallet.wallet}</span><strong>{wallet.tokenAllocation.toString()} TOKEN</strong><small>{wallet.refund.toString()} REFUND</small></div>)}</div>}
        </div>
      </div>
      <div className="launch-pipeline launch-pipeline--v1"><span>DRAFT</span><i>→</i><span>METADATA</span><i>→</i><span>SANDBOX</span><i>→</i><span>PEER + SECURITY</span><i>→</i><span>TESTNET</span><button disabled={!validation.ready} onClick={() => setSubmitted(true)}>{submitted ? "✓ REVIEW PACKAGE SEALED" : "QUEUE GATED PROPOSAL"}</button></div>
    </div>
  );
}
