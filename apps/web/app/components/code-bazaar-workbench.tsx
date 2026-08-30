"use client";

import { useMemo, useState } from "react";

const MODULES = ["Launcher Core", "Vesting Module", "Liquidity Lock"] as const;
const DEFAULT_CODE = `// HoodedHeroes Community Proposal
export const launchTemplate = {
  fixedSupply: true,
  creatorAllocationBps: 500,
  vestingMonths: 24,
  liquidityLocked: true,
  feeCapBps: 100
};`;

export function CodeBazaarWorkbench() {
  const [module, setModule] = useState<(typeof MODULES)[number]>(MODULES[0]);
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
  return (
    <div className="bazaar-lab bazaar-lab--production">
      <div className="bazaar-tabs">{MODULES.map((item) => <button className={module === item ? "is-active" : ""} key={item} onClick={() => setModule(item)}>{item}</button>)}<span className="sandbox-pill">FIRECRACKER // DENY-ALL EGRESS</span></div>
      <div className="bazaar-workspace">
        <label><span>{module} / proposal.ts</span><textarea spellCheck={false} value={code} onChange={(event) => setCode(event.target.value)} aria-label="Launcher module code" /></label>
        <div className="bazaar-output"><span>REPRODUCIBLE EVIDENCE</span>{runCount === 0 ? <p>Local policy preview ready. A live run requires a verified HoodedHero session.</p> : checks.map(([label, ok]) => <p key={label} className={ok ? "test-pass" : "test-fail"}>{ok ? "✓" : "×"} {label}</p>)}<div className="evidence-strip"><b>DIFF</b><b>SBOM</b><b>BUILD HASH</b><b>PR</b></div></div>
      </div>
      <div className="bazaar-controls bazaar-controls--wide"><button onClick={() => setRunCount((count) => count + 1)}>▶ Run policy suite</button><button className="sandbox-button" disabled={busy} onClick={startSandbox}>{busy ? "STARTING…" : "START SECURE SANDBOX"}</button><b>{runCount ? `${passed}/${checks.length} CHECKS PASSED` : cloudState}</b><small>Approved repo only · preset commands · signed PR output · no production secrets</small></div>
    </div>
  );
}
