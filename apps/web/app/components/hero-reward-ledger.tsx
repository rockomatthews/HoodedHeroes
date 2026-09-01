"use client";

import { useEffect, useState } from "react";

type Ledger =
  | { status: "loading" | "not-configured" | "unavailable"; chainId?: number; vaultAddress?: string }
  | {
      status: "live";
      chainId: number;
      blockNumber: string;
      vaultAddress: string;
      rewardAsset: { address: string; symbol: string; decimals: number };
      eligibleHeroes: number;
      rounds: string;
      totals: { funded: string; claimable: string; delivered: string; carry: string; rewardPerHero: string; vaultBalance: string; accounted: string; surplus: string };
      reconciled: boolean;
    };

function displayUnits(value: string, decimals: number) {
  const amount = BigInt(value);
  const scale = 10n ** BigInt(decimals);
  const whole = amount / scale;
  const fraction = (amount % scale).toString().padStart(decimals, "0").slice(0, 4).replace(/0+$/, "");
  return `${whole.toLocaleString("en-US")}${fraction ? `.${fraction}` : ""}`;
}

export function HeroRewardLedger() {
  const [ledger, setLedger] = useState<Ledger>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/rewards/hero-rounds", { signal: controller.signal })
      .then(async (response) => response.json() as Promise<Ledger>)
      .then(setLedger)
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setLedger({ status: "unavailable" });
      });
    return () => controller.abort();
  }, []);

  if (ledger.status !== "live") {
    const label = ledger.status === "loading" ? "READING ROBINHOOD CHAIN…" : ledger.status === "not-configured" ? "CANARY NOT CONFIGURED" : "LEDGER READ UNAVAILABLE";
    return <section className="reward-ledger reward-ledger--empty" aria-label="Hero reward ledger"><div className="reward-ledger-seal">H</div><div><span>UNIVERSAL HERO REWARDS // PUBLIC LEDGER</span><h3>{label}</h3><p>No placeholder balances are shown. Live totals appear only after a reviewed vault address is configured and verified on-chain.</p></div></section>;
  }

  const unit = ledger.rewardAsset.symbol;
  const metric = (value: string) => `${displayUnits(value, ledger.rewardAsset.decimals)} ${unit}`;
  return (
    <section className="reward-ledger" aria-label="Hero reward ledger">
      <header><div><span>UNIVERSAL HERO REWARDS // ROBINHOOD CHAIN</span><h3>THE COMMUNITY FEE LEDGER</h3></div><b className={ledger.reconciled ? "is-reconciled" : "is-broken"}>{ledger.reconciled ? "✓ RECONCILED" : "× MISMATCH"}</b></header>
      <div className="reward-ledger-metrics">
        <article><small>TOTAL FUNDED</small><strong>{metric(ledger.totals.funded)}</strong></article>
        <article><small>OWED TO HEROES</small><strong>{metric(ledger.totals.claimable)}</strong></article>
        <article><small>DELIVERED</small><strong>{metric(ledger.totals.delivered)}</strong></article>
        <article><small>NEXT-ROUND CARRY</small><strong>{metric(ledger.totals.carry)}</strong></article>
      </div>
      <div className="reward-ledger-flow"><span>LAUNCH FEES</span><i>→</i><span>WRAP ETH</span><i>→</i><span>EQUAL HERO ROUND</span><i>→</i><span>CURRENT NFT OWNER</span></div>
      <footer><span>{`${ledger.rounds} ROUNDS // ${ledger.eligibleHeroes} ELIGIBLE HEROES // BLOCK ${ledger.blockNumber}`}</span><code>{`${ledger.vaultAddress.slice(0, 8)}…${ledger.vaultAddress.slice(-6)}`}</code></footer>
    </section>
  );
}
