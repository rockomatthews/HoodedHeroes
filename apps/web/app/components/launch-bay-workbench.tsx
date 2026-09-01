"use client";

import { useMemo, useState } from "react";
import {
  HOODED_GENESIS_MANIFEST,
  buildDexScreenerProfile,
  buildMetaplexMetadata,
  buildUniswapTokenList,
  simulateProRataLaunch,
  validateLaunchManifest,
  type LaunchChain,
  type LaunchManifestV1,
} from "@hooded/shared";

const CHAINS: { id: LaunchChain; label: string; status: string; color: string }[] = [
  { id: "robinhood", label: "RH CHAIN", status: "V1 RELEASE PATH", color: "green" },
  { id: "base", label: "BASE", status: "UNAVAILABLE // AUDIT REQUIRED", color: "blue" },
  { id: "solana", label: "SOLANA", status: "UNAVAILABLE // NOT IMPLEMENTED", color: "purple" },
];

function cloneGenesis() {
  return structuredClone(HOODED_GENESIS_MANIFEST);
}

function manifestForChain(chain: LaunchChain, creatorWallet?: string): LaunchManifestV1 {
  const manifest = cloneGenesis();
  if (creatorWallet) {
    manifest.metadata.creatorWallet = creatorWallet;
    manifest.metadata.revision.authorWallet = creatorWallet;
  }
  if (chain === "robinhood") return manifest;

  manifest.metadata.chain = chain;
  manifest.metadata.projectId = `community-${chain}-draft`;
  manifest.metadata.name = "Community Launch";
  manifest.metadata.symbol = "BUILD";
  manifest.metadata.canonicalLaunchUrl = `https://hooded.world/launch/community-${chain}-draft`;
  manifest.metadata.publication.summary = `A community-built ${chain === "base" ? "Base" : "Solana"} launch prepared through HOODED.`;
  manifest.metadata.publication.description = "A transparent fixed-supply community proposal using pro-rata allocation, reproducible builds, visible fees, and permanently locked liquidity.";
  manifest.metadata.publication.utility = "A customizable community utility defined and reviewed through Code Bazaar.";
  manifest.sale.quoteAsset = chain === "solana" ? "SOL" : "ETH";
  manifest.liquidity.venue = chain === "solana" ? "raydium-cpmm" : "uniswap-v4";
  return manifest;
}

export function LaunchBayWorkbench() {
  const [manifest, setManifest] = useState(cloneGenesis);
  const [submitted, setSubmitted] = useState(false);
  const [view, setView] = useState<"audit" | "metadata" | "simulation">("audit");
  const validation = useMemo(() => validateLaunchManifest(manifest), [manifest]);
  const simulation = useMemo(() => simulateProRataLaunch({
    saleTokenAllocation: 400_000_000n,
    maximumRaise: 100_000n,
    contributions: [
      { wallet: "CRIMSON", amount: 80_000n },
      { wallet: "AZURE", amount: 50_000n },
      { wallet: "EMERALD", amount: 30_000n },
    ],
  }), []);

  function updateMetadata<Key extends keyof LaunchManifestV1["metadata"]>(key: Key, value: LaunchManifestV1["metadata"][Key]) {
    setSubmitted(false);
    setManifest((current) => ({ ...current, metadata: { ...current.metadata, [key]: value } }));
  }

  function updatePublication<Key extends keyof LaunchManifestV1["metadata"]["publication"]>(key: Key, value: LaunchManifestV1["metadata"]["publication"][Key]) {
    setSubmitted(false);
    setManifest((current) => ({ ...current, metadata: { ...current.metadata, publication: { ...current.metadata.publication, [key]: value } } }));
  }

  function selectChain(chain: LaunchChain) {
    setSubmitted(false);
    setManifest((current) => manifestForChain(chain, current.metadata.creatorWallet));
  }

  const chainId = manifest.metadata.chain === "robinhood" ? 4663 : 8453;
  const distributionPreview = manifest.metadata.chain === "solana"
    ? buildMetaplexMetadata(manifest.metadata)
    : manifest.metadata.tokenAddress
      ? buildUniswapTokenList(manifest.metadata, chainId)
      : { tokenList: "Generated after deterministic contract address is prepared", dexScreener: "Profile package staged after deployment" };
  const dexPreview = manifest.metadata.tokenAddress ? buildDexScreenerProfile(manifest.metadata) : null;
  const isGenesis = manifest.metadata.projectId === "hooded-genesis";

  return (
    <div className="launch-builder launch-builder--v1">
      <div className="chain-selector">
        {CHAINS.map((chain) => (
          <button key={chain.id} disabled={chain.id !== "robinhood"} className={`${manifest.metadata.chain === chain.id ? "is-active" : ""} chain-${chain.color}`} onClick={() => selectChain(chain.id)}>
            <b>{chain.label}</b><small>{chain.status}</small>
          </button>
        ))}
      </div>
      <div className="launch-builder-grid">
        <div className="launch-form launch-form--manifest">
          <div className={`launch-project-banner ${isGenesis ? "is-genesis" : ""}`}><b>{isGenesis ? "HOODED GENESIS" : "COMMUNITY TEMPLATE"}</b><span>{isGenesis ? "FIRST LAUNCH // ROBINHOOD" : `${manifest.metadata.chain.toUpperCase()} // DRAFT`}</span></div>
          <div className="launch-field launch-field--wide"><label>Project name<input aria-label="Project name" value={manifest.metadata.name} onChange={(event) => updateMetadata("name", event.target.value)} /></label><label>Symbol<input aria-label="Token symbol" value={manifest.metadata.symbol} maxLength={10} onChange={(event) => updateMetadata("symbol", event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} /></label></div>
          <div className="launch-field launch-field--wide"><label>Exact supply // base units<input aria-label="Fixed supply" value={manifest.metadata.exactSupply} onChange={(event) => updateMetadata("exactSupply", event.target.value.replace(/\D/g, ""))} /></label><label>Quote asset<input aria-label="Quote asset" value={manifest.sale.quoteAsset} readOnly /></label></div>
          <div className="launch-field"><label>Bound owner wallet<input aria-label="Bound owner wallet" value={manifest.metadata.creatorWallet} onChange={(event) => updateMetadata("creatorWallet", event.target.value.trim())} /></label></div>
          <div className="launch-field"><label>Discovery summary<input aria-label="Discovery summary" value={manifest.metadata.publication.summary} onChange={(event) => updatePublication("summary", event.target.value)} /></label></div>
          <div className="allocation-cards"><span><b>40%</b> FAIR LAUNCH</span><span><b>30%</b> REWARDS</span><span><b>15%</b> LOCKED LP</span><span><b>10%</b> DAO</span><span><b>5%</b> VESTED</span></div>
          <div className="launch-terms"><span>PRO-RATA WINDOW</span><span>0.75% FEE</span><span>1% HARD CAP</span><span>NO ADMIN WITHDRAW</span></div>
        </div>
        <div className="launch-audit launch-audit--tabs">
          <div className="launch-view-tabs"><button className={view === "audit" ? "is-active" : ""} onClick={() => setView("audit")}>15 GATES</button><button className={view === "metadata" ? "is-active" : ""} onClick={() => setView("metadata")}>METADATA</button><button className={view === "simulation" ? "is-active" : ""} onClick={() => setView("simulation")}>SIM</button></div>
          {view === "audit" && <><div className="launch-score"><span>MANIFEST READINESS</span><strong>{validation.passed}/{validation.total}</strong><b className={validation.ready ? "is-ready" : "is-blocked"}>{validation.ready ? "REVIEW PACKAGE READY" : "REAL EVIDENCE REQUIRED"}</b></div><div className="launch-checks launch-checks--dense">{validation.checks.map((check) => <div key={check.id} className={check.passed ? "is-pass" : "is-fail"} title={check.detail}><i>{check.passed ? "✓" : "×"}</i><span>{check.label}</span></div>)}</div></>}
          {view === "metadata" && <div className="metadata-preview"><b>MAX-EXPOSURE PACKAGE</b><p>Metaplex · Uniswap List · Blockscout · DEX Screener · CoinGecko · OG 1200×630</p><pre>{JSON.stringify(distributionPreview, null, 2).slice(0, 600)}</pre>{dexPreview && <small>DEX profile ready</small>}</div>}
          {view === "simulation" && <div className="simulation-preview"><b>OVERSUBSCRIBED // SAME PRICE</b>{simulation.wallets.map((wallet) => <div key={wallet.wallet}><span>{wallet.wallet}</span><strong>{wallet.tokenAllocation.toString()} TOKEN</strong><small>{wallet.refund.toString()} REFUND</small></div>)}</div>}
        </div>
      </div>
      <div className="launch-pipeline launch-pipeline--v1"><span>DRAFT</span><i>→</i><span>LOCAL + FORK</span><i>→</i><span>SECURITY</span><i>→</i><span>MAINNET SIM</span><i>→</i><span>WALLET SIGN</span><button disabled={!validation.ready} onClick={() => setSubmitted(true)}>{submitted ? "✓ REVIEW PACKAGE SEALED" : validation.ready ? "QUEUE REVIEW PACKAGE" : `${validation.total - validation.passed} GATES BLOCKED`}</button></div>
    </div>
  );
}
