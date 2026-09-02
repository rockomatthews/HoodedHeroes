"use client";

import { createRound, isAdjacent, scorePath, type Cell } from "@hooded/game-engine";
import { useEffect, useMemo, useState, type MouseEvent } from "react";

type NetworkState = "idle" | "loading" | "ready" | "blocked";

export function MissionDeckWorkbench() {
  const [seed, setSeed] = useState(4663);
  const [path, setPath] = useState<Cell[]>([]);
  const [startedAt, setStartedAt] = useState(0);
  const [completedElapsed, setCompletedElapsed] = useState(0);
  const round = useMemo(() => createRound(seed, 0), [seed]);
  const finished = path.at(-1)?.x === round.target.x && path.at(-1)?.y === round.target.y;

  function begin(event: MouseEvent<HTMLButtonElement>) {
    setSeed((current) => (Math.imul(current, 1_664_525) + 1_013_904_223) >>> 0);
    setPath([]);
    setCompletedElapsed(0);
    setStartedAt(event.timeStamp);
  }

  function choose(cell: Cell, event: MouseEvent<HTMLButtonElement>) {
    if (!startedAt || finished || round.hazards.some((hazard) => hazard.x === cell.x && hazard.y === cell.y)) return;
    if (path.length === 0) {
      if (cell.x === round.start.x && cell.y === round.start.y) setPath([cell]);
      return;
    }
    if (!path.some((item) => item.x === cell.x && item.y === cell.y) && isAdjacent(path[path.length - 1], cell)) {
      if (cell.x === round.target.x && cell.y === round.target.y) setCompletedElapsed(Math.max(250, event.timeStamp - startedAt));
      setPath((current) => [...current, cell]);
    }
  }

  return <section className="district-workbench mission-console" aria-label="Mission Deck operations">
    <header><div><b>POWER GRID // PRACTICE TRACE</b><span>DETERMINISTIC SEED {seed}</span></div><button onClick={begin}>{startedAt ? "RESTART GRID" : "START GRID"}</button></header>
    <div className="power-grid" role="grid" aria-label="Power Grid practice board">
      {Array.from({ length: 40 }, (_, index) => ({ x: index % 8, y: Math.floor(index / 8) })).map((cell) => {
        const hazard = round.hazards.some((item) => item.x === cell.x && item.y === cell.y);
        const selected = path.some((item) => item.x === cell.x && item.y === cell.y);
        const start = cell.x === round.start.x && cell.y === round.start.y;
        const target = cell.x === round.target.x && cell.y === round.target.y;
        return <button key={`${cell.x}-${cell.y}`} role="gridcell" aria-label={`Grid ${cell.x},${cell.y}${hazard ? " hazard" : target ? " target" : start ? " start" : ""}`} className={`${hazard ? "is-hazard" : ""} ${selected ? "is-path" : ""} ${start ? "is-start" : ""} ${target ? "is-target" : ""}`} onClick={(event) => choose(cell, event)} disabled={!startedAt || hazard || finished}>{hazard ? "×" : target ? "◎" : start ? "▶" : selected ? "•" : ""}</button>;
      })}
    </div>
    <footer><span>{!startedAt ? "START, THEN ROUTE FROM ▶ TO ◎" : finished ? "TRACE COMPLETE" : `${path.length} NODES ROUTED`}</span><strong>{finished ? `${scorePath(path, completedElapsed, 1)} PRACTICE SCORE` : "NO REWARD CREDIT"}</strong><small>Signed reward scoring remains locked until Hero ownership and atomic nonce storage are live.</small></footer>
  </section>;
}

type LaunchSummary = { metadata?: { projectId?: string; name?: string; symbol?: string }; lifecycle?: string };

export function AssemblyWorkbench() {
  const [launches, setLaunches] = useState<LaunchSummary[]>([]);
  const [selected, setSelected] = useState("");
  const [state, setState] = useState<NetworkState>("loading");
  const [message, setMessage] = useState("READING PROPOSAL REGISTRY…");
  const [evidenceHash, setEvidenceHash] = useState("");

  useEffect(() => {
    void fetch("/api/launches", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error("Registry unavailable");
      const payload = await response.json() as { launches?: LaunchSummary[] };
      const records = payload.launches ?? [];
      setLaunches(records);
      setSelected(records[0]?.metadata?.projectId ?? "");
      setState("ready");
      setMessage(records.length ? "PUBLIC REGISTRY VERIFIED" : "NO PROPOSALS REGISTERED");
    }).catch(() => { setState("blocked"); setMessage("PROPOSAL REGISTRY UNAVAILABLE"); });
  }, []);

  async function submitReview(decision: "approve" | "request-changes") {
    if (!selected) return;
    setState("loading");
    const response = await fetch("/api/assembly/reviews", { method: "POST", headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID().replaceAll("-", "") }, body: JSON.stringify({ projectId: selected, decision, evidenceHash }) });
    const payload = await response.json().catch(() => ({})) as { error?: string };
    setState(response.ok ? "ready" : "blocked");
    setMessage(response.ok ? "PEER REVIEW RECORDED" : (payload.error?.toUpperCase() ?? "REVIEW REJECTED"));
  }

  return <section className="district-workbench assembly-console" aria-label="Assembly governance">
    <header><div><b>PROPOSAL REGISTRY</b><span>{message}</span></div><i data-state={state}>{state}</i></header>
    <div className="assembly-list">{launches.map((launch) => <button key={launch.metadata?.projectId} className={selected === launch.metadata?.projectId ? "is-active" : ""} onClick={() => setSelected(launch.metadata?.projectId ?? "")}><b>{launch.metadata?.name ?? "UNNAMED"}</b><span>${launch.metadata?.symbol ?? "—"}</span><small>{launch.lifecycle ?? "DRAFT"}</small></button>)}</div>
    <label className="assembly-evidence">REVIEWED EVIDENCE HASH<input aria-label="Reviewed evidence hash" placeholder="0x…64 hex characters" value={evidenceHash} onChange={(event) => setEvidenceHash(event.target.value.trim())} /></label>
    <div className="assembly-actions"><button disabled={!selected || state === "loading" || !/^0x[a-fA-F0-9]{64}$/.test(evidenceHash)} onClick={() => void submitReview("approve")}>ATTEST PEER APPROVAL</button><button disabled={!selected || state === "loading" || !/^0x[a-fA-F0-9]{64}$/.test(evidenceHash)} onClick={() => void submitReview("request-changes")}>REQUEST CHANGES</button></div>
    <p>Votes are one eligible wallet / one vote. Peer review records evidence; it never deploys, activates, or bypasses Security Council approval.</p>
  </section>;
}

type VaultPayload = { eligibility: { identityVerified: boolean; jurisdictionAllowed: boolean; sanctionsClear: boolean; walletControlVerified: boolean; expiresAt: string | null }; assets: { symbol: string; status: string }[] };

export function StockVaultWorkbench() {
  const [payload, setPayload] = useState<VaultPayload | null>(null);
  const [message, setMessage] = useState("NOT CHECKED");
  async function refresh() {
    setMessage("VERIFYING…");
    const response = await fetch("/api/stock-vault/status", { cache: "no-store" });
    const body = await response.json().catch(() => ({})) as VaultPayload & { error?: string };
    if (!response.ok) { setMessage(body.error?.toUpperCase() ?? "VAULT UNAVAILABLE"); return; }
    setPayload(body); setMessage("LIVE ELIGIBILITY READBACK");
  }
  return <section className="district-workbench stock-console" aria-label="Stock Token Vault eligibility">
    <header><div><b>RESTRICTED REWARD VAULT</b><span>{message}</span></div><button onClick={() => void refresh()}>CHECK ELIGIBILITY</button></header>
    <div className="stock-assets">{(payload?.assets ?? ["AAPL", "NVDA", "AMZN", "GOOGL", "MSFT", "TSLA"].map((symbol) => ({ symbol, status: "unconfigured" }))).map((asset) => <article key={asset.symbol}><strong>{asset.symbol}</strong><span>{asset.status.toUpperCase()}</span></article>)}</div>
    <div className="eligibility-grid">{Object.entries(payload?.eligibility ?? { identityVerified: false, jurisdictionAllowed: false, sanctionsClear: false, walletControlVerified: false }).filter(([key]) => key !== "expiresAt").map(([key, value]) => <span key={key} className={value ? "is-pass" : "is-blocked"}><b>{value ? "✓" : "×"}</b>{key.replace(/[A-Z]/g, (letter) => ` ${letter}`).toUpperCase()}</span>)}</div>
    <p>No claim is exposed unless every check is current and a funded, contract-backed reward pool is indexed. Prohibited claimants receive no substitute.</p>
  </section>;
}

const ABILITIES = ["GRID SURGE", "DRONE VEIL", "CIPHER SIGHT"] as const;
const GEAR = ["ARC RELAY", "SIGNAL CLOAK", "RESCUE BEACON"] as const;

export function WorkshopWorkbench() {
  const [ability, setAbility] = useState<(typeof ABILITIES)[number]>(ABILITIES[0]);
  const [gear, setGear] = useState<(typeof GEAR)[number]>(GEAR[0]);
  const [message, setMessage] = useState("UNSAVED LOADOUT DRAFT");
  async function save() {
    setMessage("SAVING…");
    const response = await fetch("/api/workshop/loadout", { method: "PUT", headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID().replaceAll("-", "") }, body: JSON.stringify({ ability, gear }) });
    const body = await response.json().catch(() => ({})) as { error?: string };
    setMessage(response.ok ? "LOADOUT SAVED TO HERO-GATED PROFILE" : (body.error?.toUpperCase() ?? "SAVE REJECTED"));
  }
  return <section className="district-workbench workshop-console" aria-label="Hero Workshop loadout">
    <header><div><b>LOADOUT BENCH</b><span>{message}</span></div><button onClick={() => void save()}>SAVE LOADOUT</button></header>
    <div className="workshop-options"><fieldset><legend>ABILITY</legend>{ABILITIES.map((item) => <button className={ability === item ? "is-active" : ""} key={item} onClick={() => setAbility(item)}>{item}</button>)}</fieldset><fieldset><legend>GEAR</legend>{GEAR.map((item) => <button className={gear === item ? "is-active" : ""} key={item} onClick={() => setGear(item)}>{item}</button>)}</fieldset></div>
    <aside><span>ABILITY <b>{ability}</b></span><span>GEAR <b>{gear}</b></span><small>Loadout changes do not spend Salary Credits or mutate on-chain progression.</small></aside>
  </section>;
}
