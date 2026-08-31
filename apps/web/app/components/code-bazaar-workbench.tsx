"use client";

import { useMemo, useState } from "react";
import { LAUNCH_BAY_PROJECT } from "@hoodedheroes/shared";

const MODULES = LAUNCH_BAY_PROJECT.workstreams.slice(0, 3);
const DEFAULT_CODE = `// HoodedHeroes Community Proposal
export const launchTemplate = {
  fixedSupply: true,
  creatorAllocationBps: 500,
  vestingMonths: 24,
  liquidityLocked: true,
  feeCapBps: 100
};`;

export function CodeBazaarWorkbench() {
  const [moduleId, setModuleId] = useState(MODULES[0].id);
  const [view, setView] = useState<"workbench" | "bounties">("workbench");
  const [code, setCode] = useState(DEFAULT_CODE);
  const [runCount, setRunCount] = useState(0);
  const [cloudState, setCloudState] = useState("SECURE SANDBOX OFFLINE");
  const [busy, setBusy] = useState(false);
  const checks = useMemo(() => [
    ["Fixed supply", /fixedSupply:\s*true/.test(code)],
    ["Creator allocation ≤ 10%", Number(code.match(/creatorAllocationBps:\s*(\d+)/)?.[1] ?? 10001) <= 1000],
    ["Vesting ≥ 12 months", Number(code.match(/vestingMonths:\s*(\d+)/)?.[1] ?? 0) >= 12],
    ["Liquidity locked", /liquidityLocked:\s*true/.test(code)],
    ["Fee cap ≤ 1%", Number(code.match(/feeCapBps:\s*(\d+)/)?.[1] ?? 10001) <= 100],
  ] as const, [code]);

  async function startSandbox() {
    setBusy(true);
    setCloudState("REQUESTING HERO-GATED MICROVM…");
    try {
      const response = await fetch("/api/sandbox/sessions", {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID().replaceAll("-", "") },
        body: JSON.stringify({ repository: "rockomatthews/HoodedHeroes", runtime: "web-evm-v1" }),
      });
      const result = await response.json() as { error?: string; id?: string };
      setCloudState(response.ok ? `MICROVM READY // ${result.id?.slice(0, 8)}` : `LOCKED // ${result.error ?? "NOT AVAILABLE"}`);
    } catch {
      setCloudState("SANDBOX CONTROL PLANE UNREACHABLE");
    } finally {
      setBusy(false);
    }
  }

  const passed = checks.filter(([, ok]) => ok).length;
  const selectedWorkstream = MODULES.find((item) => item.id === moduleId) ?? MODULES[0];
  return (
    <div className="bazaar-lab bazaar-lab--production">
      <header className="bazaar-project-card"><div><span>{`${LAUNCH_BAY_PROJECT.codename} // FIRST SOCIETY PROJECT`}</span><strong>{LAUNCH_BAY_PROJECT.name}</strong><p>{LAUNCH_BAY_PROJECT.mission}</p></div><aside><b>{`v${LAUNCH_BAY_PROJECT.version}`}</b><span>{LAUNCH_BAY_PROJECT.license}</span><i>PR-ONLY</i></aside></header>
      <div className="bazaar-tabs"><button className={view === "workbench" ? "is-active" : ""} onClick={() => setView("workbench")}>WORKBENCH</button><button className={view === "bounties" ? "is-active" : ""} onClick={() => setView("bounties")}>OPEN BOUNTIES</button>{view === "workbench" && MODULES.map((item) => <button className={moduleId === item.id ? "is-module-active" : ""} key={item.id} onClick={() => setModuleId(item.id)}>{item.label}</button>)}<span className="sandbox-pill">FIRECRACKER // DENY-ALL EGRESS</span></div>
      {view === "workbench" ? <div className="bazaar-workspace">
        <label><span>{selectedWorkstream.path} / proposal.ts</span><textarea spellCheck={false} value={code} onChange={(event) => setCode(event.target.value)} aria-label="Launcher module code" /></label>
        <div className="bazaar-output"><span>{`REPRODUCIBLE EVIDENCE // ${selectedWorkstream.stage}`}</span>{runCount === 0 ? <><p>Local policy preview ready. A live run requires a verified HoodedHero session.</p>{selectedWorkstream.checks.map((check) => <p key={check}>{`○ REQUIRED // ${check}`}</p>)}</> : checks.map(([label, ok]) => <p key={label} className={ok ? "test-pass" : "test-fail"}>{ok ? "✓" : "×"} {label}</p>)}<div className="evidence-strip"><b>DIFF</b><b>SBOM</b><b>BUILD HASH</b><b>PR</b></div></div>
      </div> : <div className="bazaar-bounties">{LAUNCH_BAY_PROJECT.bounties.map((bounty) => <article key={bounty.id} className={`priority-${bounty.priority}`}><span>{`${bounty.id} // ${bounty.discipline}`}</span><strong>{bounty.title}</strong><small>PROOF REQUIRED: {bounty.evidence}</small><button>CLAIM AFTER HERO SIGN-IN</button></article>)}</div>}
      <div className="bazaar-controls bazaar-controls--wide"><button onClick={() => setRunCount((count) => count + 1)}>▶ Run policy suite</button><button className="sandbox-button" disabled={busy} onClick={startSandbox}>{busy ? "STARTING…" : "START SECURE SANDBOX"}</button><b>{runCount ? `${passed}/${checks.length} CHECKS PASSED` : cloudState}</b><small>Approved repo only · preset commands · signed PR output · no production secrets</small></div>
    </div>
  );
}
