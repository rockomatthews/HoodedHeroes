"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatUnits } from "viem";

type AccessLevel = "vestibule" | "preview" | "hero";

type AccessStatus = {
  configured: boolean;
  authenticated?: boolean;
  wallet?: string;
  access: AccessLevel;
  hoodedBalance?: string;
  genesisHeroBalance?: string;
  error?: string;
};

type InjectedProvider = {
  request(input: { method: string; params?: unknown[] }): Promise<unknown>;
};

const REVEAL_MS = 900;

function injectedProvider() {
  return (window as typeof window & { ethereum?: InjectedProvider }).ethereum;
}

function compactWallet(wallet?: string) {
  return wallet ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : "NO WALLET VERIFIED";
}

function displayHooded(raw?: string) {
  if (!raw) return "0";
  const [whole] = formatUnits(BigInt(raw), 18).split(".");
  return BigInt(whole || "0").toLocaleString("en-US");
}

async function readStatus(): Promise<AccessStatus> {
  const response = await fetch("/api/access/status", { cache: "no-store" });
  const body = await response.json() as AccessStatus;
  if (!response.ok) throw new Error(body.error ?? "Membership verification failed");
  return body;
}

export function SocietyAccessGate({ onExit, onUnlock }: { onExit: () => void; onUnlock: () => void }) {
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<AccessStatus>({ configured: false, access: "vestibule" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    const revealTimer = window.setTimeout(() => {
      if (alive) setVisible(true);
    }, REVEAL_MS);
    void readStatus().catch(() => ({ configured: false, access: "vestibule" as const })).then((next) => {
      if (!alive) return;
      setStatus(next);
      if (next.access === "hero") onUnlock();
    });
    return () => {
      alive = false;
      window.clearTimeout(revealTimer);
    };
  }, [onUnlock]);

  async function verifyWallet() {
    setBusy(true);
    setError("");
    try {
      const provider = injectedProvider();
      if (!provider) throw new Error("A browser wallet is required to answer the Society signal.");
      const accounts = await provider.request({ method: "eth_requestAccounts" }) as string[];
      const wallet = accounts[0];
      if (!wallet) throw new Error("No wallet was selected.");
      const challengeResponse = await fetch("/api/access/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet }),
      });
      const challenge = await challengeResponse.json() as { message?: string; error?: string };
      if (!challengeResponse.ok || !challenge.message) throw new Error(challenge.error ?? "The Society challenge could not be issued.");
      const signature = await provider.request({ method: "personal_sign", params: [challenge.message, wallet] }) as string;
      const verificationResponse = await fetch("/api/access/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet, signature }),
      });
      const next = await verificationResponse.json() as AccessStatus;
      if (!verificationResponse.ok) throw new Error(next.error ?? "Wallet verification failed.");
      setStatus({ ...next, configured: true, authenticated: true });
      if (next.access === "hero") onUnlock();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The signal was interrupted.");
    } finally {
      setBusy(false);
    }
  }

  async function recheckAccess() {
    setBusy(true);
    setError("");
    try {
      const next = await readStatus();
      setStatus(next);
      if (next.access === "hero") onUnlock();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The signal was interrupted.");
    } finally {
      setBusy(false);
    }
  }

  if (!visible) return null;
  const heroRequired = status.access === "preview";

  return (
    <div className="society-gate" role="dialog" aria-modal="true" aria-label={heroRequired ? "Genesis Hero access required" : "HOODED membership required"}>
      <div className={`society-gate__card ${heroRequired ? "society-gate__card--hero" : ""}`}>
        <header className="society-gate__header">
          <div className="society-gate__sigil" aria-hidden="true"><span>H</span></div>
          <div><small>{heroRequired ? "SECOND SEAL // IDENTITY" : "FIRST SEAL // HOLDING"}</small><strong>{heroRequired ? "A HERO MUST ANSWER" : "THE SOCIETY IS PRIVATE"}</strong></div>
          <button onClick={onExit} aria-label="Leave the Society gate">×</button>
        </header>

        {heroRequired ? (
          <>
            <div className="society-gate__accepted"><i>✓</i><span><small>FIRST SEAL ACCEPTED</small><strong>25,000+ $HOODED</strong></span></div>
            <div className="society-gate__hero-key">
              <div className="society-gate__hood" aria-hidden="true"><i /><i /></div>
              <span><small>THE FINAL KEY</small><strong>OWN 1 GENESIS HERO</strong><p>Only a current Hero holder can enter the Command Center, Code Bazaar, Assembly, and Launch Bay.</p></span>
            </div>
            <div className="society-gate__identity"><span>{compactWallet(status.wallet)}</span><b>{status.genesisHeroBalance ?? "0"} HEROES DETECTED</b></div>
            <button className="society-gate__primary" onClick={recheckAccess} disabled={busy}>{busy ? "SEARCHING THE CHAIN…" : "RECHECK HERO OWNERSHIP"}</button>
            <Link className="society-gate__secondary" href="/launch/hooded-genesis#genesis-heroes">ACQUIRE A GENESIS HERO <span>→</span></Link>
          </>
        ) : (
          <>
            <nav className="society-gate__tabs" aria-label="Membership gate stages"><b>HOODED</b><span>HERO</span><span>ENTER</span></nav>
            <div className="society-gate__token-well">
              <small>YOUR VERIFIED HOLDING</small>
              <div><strong>{status.authenticated ? displayHooded(status.hoodedBalance) : "—"}</strong><span><i>H</i>$HOODED</span></div>
              <p>{compactWallet(status.wallet)}</p>
            </div>
            <div className="society-gate__switch" aria-hidden="true">↓</div>
            <div className="society-gate__token-well society-gate__token-well--required">
              <small>MINIMUM SIGNAL REQUIRED</small>
              <div><strong>25,000</strong><span><i>H</i>$HOODED</span></div>
              <p>Hold this amount to reveal the second seal.</p>
            </div>
            <button className="society-gate__primary" onClick={status.authenticated ? recheckAccess : verifyWallet} disabled={busy || !status.configured}>
              {busy ? "READING ROBINHOOD CHAIN…" : status.configured ? (status.authenticated ? "RECHECK $HOODED HOLDING" : "SIGN IN TO VERIFY") : "MEMBERSHIP SIGNAL SEALED"}
            </button>
            <Link className="society-gate__secondary" href="/launch/hooded-genesis">FIND $HOODED <span>→</span></Link>
          </>
        )}

        {error && <p className="society-gate__error" role="alert">{error}</p>}
        {!status.configured && !heroRequired && <p className="society-gate__notice">The verification contract is not live yet. The door remains sealed; no simulated balance can open it.</p>}
        <footer><span>NO TRANSACTION REQUESTED</span><b>WALLET CONTROL + LIVE ON-CHAIN OWNERSHIP</b></footer>
      </div>
    </div>
  );
}
