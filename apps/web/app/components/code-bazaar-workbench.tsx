"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LAUNCH_BAY_PROJECT } from "@hooded/shared";

const MODULES = LAUNCH_BAY_PROJECT.workstreams.filter((item) => item.stage !== "planned");
const MODULE_FILES: Record<string, string> = {
  "launcher-core": "packages/contracts/src/ProductionLaunchFactory.sol",
  "manifest-studio": "packages/shared/src/launch-manifest.ts",
  "hero-genesis": "packages/contracts/src/HoodedGenesis.sol",
  "hero-rounds": "packages/contracts/src/HeroRoundRewardVault.sol",
};
const DEFAULT_CODE = `// HOODED Community Proposal
export const launchTemplate = {
  fixedSupply: true,
  creatorAllocationBps: 500,
  vestingMonths: 24,
  liquidityLocked: true,
  feeCapBps: 100
};`;

export function CodeBazaarWorkbench() {
  const router = useRouter();
  const [moduleId, setModuleId] = useState(MODULES[0].id);
  const [view, setView] = useState<"workbench" | "bounties">("workbench");
  const [code, setCode] = useState(DEFAULT_CODE);
  const [runCount, setRunCount] = useState(0);
  const [lastRunPassed, setLastRunPassed] = useState(false);
  const [cloudState, setCloudState] = useState("SECURE SANDBOX OFFLINE");
  const [busy, setBusy] = useState(false);
  const [githubState, setGithubState] = useState("GITHUB NOT CONNECTED");
  const [sandboxId, setSandboxId] = useState<string | null>(null);
  const [terminal, setTerminal] = useState("Start a secure sandbox to load the reviewed repository snapshot.");
  useEffect(() => {
    fetch("/api/github/access")
      .then(async (response) => ({ ok: response.ok, body: await response.json() as { connected?: boolean; grant?: { github_login?: string } } }))
      .then(({ ok, body }) => setGithubState(ok && body.connected ? `GITHUB CONNECTED // @${body.grant?.github_login}` : "GITHUB READY AFTER HERO SIGN-IN"))
      .catch(() => setGithubState("GITHUB CONTROL PLANE OFFLINE"));
  }, []);
  async function startSandbox() {
    setBusy(true);
    setCloudState("REQUESTING HOODED-GATED MICROVM…");
    try {
      const response = await fetch("/api/sandbox/sessions", {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID().replaceAll("-", "") },
        body: JSON.stringify({ runtime: "web-evm-v1" }),
      });
      const result = await response.json() as { error?: string; id?: string };
      if (response.ok && result.id) {
        setSandboxId(result.id);
        setCloudState(`MICROVM READY // ${result.id.slice(0, 8)}`);
        await loadSandboxFile(result.id, moduleId);
      } else setCloudState(`LOCKED // ${result.error ?? "NOT AVAILABLE"}`);
    } catch {
      setCloudState("SANDBOX CONTROL PLANE UNREACHABLE");
    } finally {
      setBusy(false);
    }
  }

  async function loadSandboxFile(sessionId = sandboxId, nextModuleId = moduleId) {
    if (!sessionId) return;
    setBusy(true);
    try {
      const path = MODULE_FILES[nextModuleId] ?? `${selectedWorkstream.path}/README.md`;
      const response = await fetch(`/api/sandbox/sessions/${sessionId}/files?path=${encodeURIComponent(path)}`, { cache: "no-store" });
      const result = await response.json() as { error?: string; content?: string; bytes?: number };
      if (!response.ok || result.content === undefined) throw new Error(result.error ?? "File read failed");
      setCode(result.content);
      setTerminal(`LOADED // ${path} // ${result.bytes ?? 0} BYTES`);
    } catch (error) {
      setTerminal(`READ BLOCKED // ${error instanceof Error ? error.message : "UNKNOWN ERROR"}`);
    } finally {
      setBusy(false);
    }
  }

  async function saveSandboxFile() {
    if (!sandboxId) return setTerminal("START A SECURE SANDBOX BEFORE SAVING");
    setBusy(true);
    const path = MODULE_FILES[moduleId] ?? `${selectedWorkstream.path}/README.md`;
    try {
      const response = await fetch(`/api/sandbox/sessions/${sandboxId}/files`, {
        method: "PUT",
        headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID().replaceAll("-", "") },
        body: JSON.stringify({ path, content: code }),
      });
      const result = await response.json() as { error?: string; contentHash?: string };
      setTerminal(response.ok ? `SAVED // SHA-256 ${result.contentHash}` : `SAVE BLOCKED // ${result.error ?? "UNKNOWN ERROR"}`);
    } catch {
      setTerminal("SANDBOX FILE CONTROL PLANE UNREACHABLE");
    } finally {
      setBusy(false);
    }
  }

  async function runSandboxTests() {
    if (!sandboxId) return setTerminal("START A SECURE SANDBOX BEFORE RUNNING TESTS");
    setBusy(true);
    try {
      const preset = moduleId === "launcher-core" || moduleId === "hero-genesis" || moduleId === "hero-rounds" ? "contract-test" : "test";
      const response = await fetch(`/api/sandbox/sessions/${sandboxId}/runs`, {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID().replaceAll("-", "") },
        body: JSON.stringify({ preset }),
      });
      const result = await response.json() as { error?: string; exitCode?: number; stdout?: string; stderr?: string; outputHash?: string };
      setRunCount((count) => count + 1);
      setLastRunPassed(response.ok && result.exitCode === 0);
      setTerminal(response.ok ? `${result.exitCode === 0 ? "PASS" : "FAIL"} // ${result.outputHash}\n${result.stdout ?? ""}\n${result.stderr ?? ""}`.slice(0, 12_000) : `RUN BLOCKED // ${result.error ?? "UNKNOWN ERROR"}`);
    } catch {
      setTerminal("SANDBOX RUN CONTROL PLANE UNREACHABLE");
    } finally {
      setBusy(false);
    }
  }

  const selectedWorkstream = MODULES.find((item) => item.id === moduleId) ?? MODULES[0];
  return (
    <div className="bazaar-lab bazaar-lab--production">
      <header className="bazaar-project-card"><div><span>{`${LAUNCH_BAY_PROJECT.codename} // FIRST SOCIETY PROJECT`}</span><strong>{LAUNCH_BAY_PROJECT.name}</strong><p>{LAUNCH_BAY_PROJECT.mission}</p></div><aside><b>{`v${LAUNCH_BAY_PROJECT.version}`}</b><span>{LAUNCH_BAY_PROJECT.license}</span><i>PR-ONLY</i></aside></header>
      <div className="bazaar-tabs"><button className={view === "workbench" ? "is-active" : ""} onClick={() => setView("workbench")}>WORKBENCH</button><button className={view === "bounties" ? "is-active" : ""} onClick={() => setView("bounties")}>OPEN BOUNTIES</button>{view === "workbench" && MODULES.map((item) => <button className={moduleId === item.id ? "is-module-active" : ""} key={item.id} onClick={() => { setModuleId(item.id); void loadSandboxFile(sandboxId, item.id); }}>{item.label}</button>)}<span className="sandbox-pill">FIRECRACKER // DENY-ALL EGRESS</span></div>
      {view === "workbench" ? <div className="bazaar-workspace">
        <label><span>{MODULE_FILES[moduleId] ?? `${selectedWorkstream.path}/README.md`}</span><textarea spellCheck={false} value={code} onChange={(event) => setCode(event.target.value)} aria-label="Launcher module code" /></label>
        <div className="bazaar-output"><span>{`REPRODUCIBLE EVIDENCE // ${selectedWorkstream.stage}`}</span><pre>{terminal}</pre>{selectedWorkstream.checks.map((check) => <p key={check}>{`${lastRunPassed ? "✓ PASS" : "○ REQUIRED"} // ${check}`}</p>)}<div className="evidence-strip"><b>DIFF</b><b>SBOM</b><b>BUILD HASH</b><b>PR</b></div></div>
      </div> : <div className="bazaar-bounties">{LAUNCH_BAY_PROJECT.bounties.map((bounty) => <article key={bounty.id} className={`priority-${bounty.priority}`}><span>{`${bounty.id} // ${bounty.discipline}`}</span><strong>{bounty.title}</strong><small>PROOF REQUIRED: {bounty.evidence}</small><button>CLAIM AFTER GENESIS HERO SIGN-IN</button></article>)}</div>}
      <div className="bazaar-controls bazaar-controls--wide">
        <button disabled={busy || !sandboxId} onClick={saveSandboxFile}>SAVE ISOLATED EDIT</button>
        <button disabled={busy || !sandboxId} onClick={runSandboxTests}>▶ RUN REVIEWED TEST PRESET</button>
        <button className="sandbox-button" disabled={busy} onClick={startSandbox}>{busy ? "STARTING…" : "START SECURE SANDBOX"}</button>
        <button onClick={() => router.push("/api/github/connect")}>CONNECT GITHUB</button>
        <button onClick={() => router.push("/api/code-bazaar/source")}>DOWNLOAD APPROVED SOURCE</button>
        <b>{runCount ? (lastRunPassed ? "SANDBOX RUN PASSED" : "SANDBOX RUN NEEDS CHANGES") : `${cloudState} // ${githubState}`}</b>
        <small>Hero-gated private repo · AGPL redistribution permitted · preset commands · signed PR output · no production secrets</small>
      </div>
    </div>
  );
}
