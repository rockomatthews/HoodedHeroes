"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import commandCenterArt from "../../../../art/concepts/02-secret-command-center.png";
import { CodeBazaarWorkbench } from "./code-bazaar-workbench";
import { CommunitySignal } from "./community-signal";
import { HeroRewardLedger } from "./hero-reward-ledger";
import { LaunchBayWorkbench } from "./launch-bay-workbench";
import { AssemblyWorkbench, MissionDeckWorkbench, StockVaultWorkbench, WorkshopWorkbench } from "./district-workbenches";

type RoomId =
  | "mission-deck"
  | "code-bazaar"
  | "assembly"
  | "launch-bay"
  | "stock-vault"
  | "workshop"
  | "season"
  | "houses"
  | "messages"
  | "missions"
  | "vault"
  | "profile"
  | "legend"
  | "community-signal";

type Room = {
  id: RoomId;
  label: string;
  eyebrow: string;
  summary: string;
  accent: "red" | "blue" | "green" | "yellow" | "purple" | "orange";
  stats: [string, string][];
  actions: string[];
};

const ROOMS: Record<RoomId, Room> = {
  "community-signal": {
    id: "community-signal", label: "Community Signal", eyebrow: "THE HOODED CREED // LIVE SOCIETY CHAT", accent: "yellow",
    summary: "The central signal belongs to every builder. Read the Creed, meet the society, and coordinate the next community-built utility.",
    stats: [["Channel", "CREED-01"], ["Network", "HOODED-GATED"], ["Purpose", "BUILD TOGETHER"]],
    actions: ["Read the Creed", "Open live chat", "Builder roll call"],
  },
  "mission-deck": {
    id: "mission-deck", label: "Mission Deck", eyebrow: "OPERATIONS // LIVE BRIEFINGS", accent: "red",
    summary: "Choose deterministic city operations, spend energy, and submit replayable action traces for signed scoring.",
    stats: [["Playable", "01"], ["Reward scoring", "LOCKED"], ["Planned", "05"]],
    actions: ["Power Grid", "Drone Dash", "Cipher Break"],
  },
  "code-bazaar": {
    id: "code-bazaar", label: "Code Bazaar", eyebrow: "PRIVATE BUILDER LAB // ISOLATED", accent: "blue",
    summary: "A members-only workshop for proposing, testing, reviewing, and improving approved launcher modules without touching production systems.",
    stats: [["Source", "GITHUB"], ["Execution", "SANDBOX"], ["Merge", "PR ONLY"]],
    actions: ["Launcher Core", "Vesting Module", "Liquidity Lock"],
  },
  assembly: {
    id: "assembly", label: "Assembly", eyebrow: "GOVERNANCE // SIX HOUSES", accent: "green",
    summary: "Review proposals, debate changes, and record one-wallet/one-vote attestations after technical and security review.",
    stats: [["Registry", "LIVE READ"], ["Voting", "HERO GATED"], ["Deploy rights", "NONE"]],
    actions: ["Proposal 018", "Security Council", "House Forum"],
  },
  "launch-bay": {
    id: "launch-bay", label: "Launch Bay", eyebrow: "AUDITED RELEASE PIPELINE", accent: "yellow",
    summary: "Move approved fixed-supply projects through reproducible builds, audit gates, contribution caps, vesting, and locked liquidity.",
    stats: [["RH adapter", "AUDIT HOLD"], ["Base", "BLOCKED"], ["Solana", "BLOCKED"]],
    actions: ["New proposal", "Audit trail", "Launch checklist"],
  },
  "stock-vault": {
    id: "stock-vault", label: "Stock Token Vault", eyebrow: "ELIGIBILITY-GATED REWARDS", accent: "purple",
    summary: "View funded Stock Token pools and jurisdiction-aware claim eligibility. Prohibited wallets receive no substitute award.",
    stats: [["Assets scoped", "06"], ["Claim window", "LOCKED"], ["Funding", "UNVERIFIED"]],
    actions: ["Eligibility", "Asset pools", "Claim history"],
  },
  workshop: {
    id: "workshop", label: "Hero Workshop", eyebrow: "CRAFT // EQUIP // UPGRADE", accent: "orange",
    summary: "Craft strategic equipment, configure abilities, and reinvest Salary Credits into earned progression.",
    stats: [["Abilities", "03"], ["Gear", "03"], ["Credit spend", "DISABLED"]],
    actions: ["Craft gear", "Ability loadout", "Blueprint archive"],
  },
  season: {
    id: "season", label: "Season 01", eyebrow: "30-DAY CITY CAMPAIGN", accent: "red",
    summary: "Track the current campaign, seasonal objectives, reward funding, and the final Legend challenge.",
    stats: [["Day", "07/30"], ["City health", "84%"], ["Your rank", "INITIATE"]],
    actions: ["Season map", "Rewards", "Legend challenge"],
  },
  houses: {
    id: "houses", label: "House Standings", eyebrow: "SOCIETY-WIDE RIVALRY", accent: "green",
    summary: "Six houses compete on verified participation, mission mastery, collaboration, and governance—not origin-tier spending.",
    stats: [["Leader", "CRIMSON"], ["Your house", "UNASSIGNED"], ["Season gap", "1,620"]],
    actions: ["All standings", "House missions", "Choose a house"],
  },
  messages: {
    id: "messages", label: "Encrypted Messages", eyebrow: "SOCIETY COMMS", accent: "yellow",
    summary: "Private notices from your house, collaborators, reviewers, and the security council.",
    stats: [["Unread", "03"], ["Mentions", "01"], ["System", "CLEAR"]],
    actions: ["Inbox", "House channel", "Review requests"],
  },
  missions: {
    id: "missions", label: "My Missions", eyebrow: "ACTIVE OPERATIONS", accent: "red",
    summary: "Resume active missions and inspect signed score receipts, replay hashes, objectives, and cooldowns.",
    stats: [["Active", "02"], ["Completed", "11"], ["Best combo", "24X"]],
    actions: ["Resume Power Grid", "Score receipts", "Mission archive"],
  },
  vault: {
    id: "vault", label: "My Vault", eyebrow: "PUBLIC REWARD ACCOUNTING // NO PLACEHOLDERS", accent: "purple",
    summary: "Reconcile every Launch Bay fee round against the reward vault balance, outstanding Hero claims, delivered value, and carry.",
    stats: [["Ledger", "PUBLIC"], ["Claims", "NFT-BOUND"], ["Weight", "1 / HERO"]],
    actions: ["Balances", "Equipment", "Reward receipts"],
  },
  profile: {
    id: "profile", label: "Hero Profile", eyebrow: "H-0001 // INITIATE", accent: "yellow",
    summary: "Manage your hero dossier, earned rank, house identity, ability loadout, and public builder reputation.",
    stats: [["Reputation", "1,250"], ["Renown", "680"], ["Tenure", "07 DAYS"]],
    actions: ["Dossier", "Progression", "Builder identity"],
  },
  legend: {
    id: "legend", label: "Become Legend", eyebrow: "THE FINAL CHALLENGE", accent: "red",
    summary: "Legend cannot be bought. Qualify through tenure, mastery, reinvestment, peer review, and a challenge-only final operation.",
    stats: [["Rank", "INITIATE"], ["Eligible", "NO"], ["Legends", "00"]],
    actions: ["Requirements", "Hall of Legends", "Training path"],
  },
};

const HOTSPOTS: { id: RoomId | "home"; className: string; label: string }[] = [
  { id: "mission-deck", className: "hotspot--mission-deck", label: "Open Mission Deck" },
  { id: "code-bazaar", className: "hotspot--code-bazaar", label: "Open Code Bazaar" },
  { id: "assembly", className: "hotspot--assembly", label: "Open Assembly" },
  { id: "launch-bay", className: "hotspot--launch-bay", label: "Open Launch Bay" },
  { id: "stock-vault", className: "hotspot--stock-vault", label: "Open Stock Token Vault" },
  { id: "workshop", className: "hotspot--workshop", label: "Open Hero Workshop" },
  { id: "season", className: "hotspot--season", label: "Open Season 01" },
  { id: "houses", className: "hotspot--houses", label: "Open House Standings" },
  { id: "legend", className: "hotspot--legend", label: "Open Become Legend" },
  { id: "home", className: "hotspot--home", label: "Return home" },
  { id: "messages", className: "hotspot--messages", label: "Open Messages" },
  { id: "missions", className: "hotspot--missions", label: "Open My Missions" },
  { id: "vault", className: "hotspot--vault", label: "Open My Vault" },
  { id: "profile", className: "hotspot--profile", label: "Open Profile" },
];

const MOBILE_ZONES = [
  { id: "briefing", label: "MISSION", icon: "!", x: 0.34 },
  { id: "bazaar", label: "CODE", icon: "</>", x: 0.55 },
  { id: "signal", label: "SIGNAL", icon: "◆", x: 0.525 },
  { id: "launch", label: "LAUNCH", icon: "▲", x: 0.79 },
  { id: "vault", label: "VAULT", icon: "◉", x: 0.32 },
  { id: "workshop", label: "GEAR", icon: "✦", x: 0.72 },
  { id: "houses", label: "HOUSES", icon: "⬡", x: 0.91 },
] as const;

export function CommandCenter({ onExit }: { onExit: () => void }) {
  const [activeRoom, setActiveRoom] = useState<RoomId | null>(null);
  const [mobileZone, setMobileZone] = useState("SIGNAL");
  const viewportRef = useRef<HTMLElement>(null);
  const active = activeRoom ? ROOMS[activeRoom] : null;

  function travelTo(x: number, label: string) {
    const viewport = viewportRef.current;
    if (!viewport) return;
    setActiveRoom(null);
    setMobileZone(label);
    viewport.scrollTo({ left: Math.max(0, viewport.scrollWidth * x - viewport.clientWidth / 2), behavior: "smooth" });
  }

  function trackMobileZone() {
    const viewport = viewportRef.current;
    if (!viewport || viewport.scrollWidth <= viewport.clientWidth) return;
    const position = (viewport.scrollLeft + viewport.clientWidth / 2) / viewport.scrollWidth;
    const nearest = MOBILE_ZONES.reduce((best, zone) => Math.abs(zone.x - position) < Math.abs(best.x - position) ? zone : best);
    setMobileZone((current) => current === nearest.label ? current : nearest.label);
  }

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !window.matchMedia("(max-aspect-ratio: 1/1)").matches) return;
    const frame = window.requestAnimationFrame(() => viewport.scrollTo({ left: Math.max(0, viewport.scrollWidth * 0.525 - viewport.clientWidth / 2) }));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <section ref={viewportRef} className="command-viewport" aria-label="HOODED Command Center" onScroll={trackMobileZone}>
      <div className="command-stage">
        <Image className="command-art" src={commandCenterArt} alt="The HOODED Command Center, with interactive rooms arranged around a six-house city map" fill priority sizes="100vw" />
        <div className="command-brand-overlay" aria-hidden="true"><strong>HOODED</strong><span>COMMAND CENTER</span></div>
        <button className="community-signal-beacon" aria-label="Open Community Signal and HOODED Creed" onClick={() => setActiveRoom("community-signal")}>
          <span>THE CREED</span>
          <strong>COMMUNITY BUILT.</strong>
          <small>EVERY UTILITY // FOREVER IMPROVED</small>
          <i><b /> COMMUNITY SIGNAL // LIVE</i>
        </button>
        {HOTSPOTS.map((spot) => (
          <button
            key={spot.id}
            className={`command-hotspot ${spot.className}`}
            aria-label={spot.label}
            onClick={() => spot.id === "home" ? onExit() : setActiveRoom(spot.id)}
          ><span>{spot.label}</span></button>
        ))}
        {active && <RoomPanel room={active} onClose={() => setActiveRoom(null)} />}
      </div>
      <div className="mobile-map-hud" aria-hidden="true"><b>HOODED TRANSIT</b><span>{active ? active.label.toUpperCase() : `${mobileZone} DISTRICT`}</span><i>{active ? "ROOM OPEN // SCROLL DOSSIER" : "SWIPE THE MAP"}</i></div>
      <nav className="mobile-map-dock" aria-label="Command Center district navigation">
        {MOBILE_ZONES.map((zone) => <button key={zone.id} className={mobileZone === zone.label ? "is-active" : ""} onClick={() => travelTo(zone.x, zone.label)}><i>{zone.icon}</i><span>{zone.label}</span></button>)}
      </nav>
    </section>
  );
}

function RoomPanel({ room, onClose }: { room: Room; onClose: () => void }) {
  const [selectedAction, setSelectedAction] = useState(room.actions[0]);

  return (
    <div className={`room-panel room-panel--${room.accent} ${room.id === "community-signal" ? "room-panel--signal" : ""}`} role="dialog" aria-modal="true" aria-label={`${room.label} panel`}>
      <button className="room-close" onClick={onClose} aria-label={`Close ${room.label}`}>×</button>
      <header className="room-heading">
        <span>{room.eyebrow}</span>
        <h2>{room.label}</h2>
        <p>{room.summary}</p>
      </header>
      <div className="room-stats">
        {room.stats.map(([label, value]) => <div key={label}><small>{label}</small><strong>{value}</strong></div>)}
      </div>
      {room.id === "code-bazaar" ? (
        <CodeBazaarWorkbench />
      ) : room.id === "community-signal" ? (
        <CommunitySignal />
      ) : room.id === "launch-bay" ? (
        <LaunchBayWorkbench />
      ) : room.id === "mission-deck" ? (
        <MissionDeckWorkbench />
      ) : room.id === "assembly" ? (
        <AssemblyWorkbench />
      ) : room.id === "stock-vault" ? (
        <StockVaultWorkbench />
      ) : room.id === "workshop" ? (
        <WorkshopWorkbench />
      ) : room.id === "vault" ? (
        <HeroRewardLedger />
      ) : (
        <div className="room-actions">{room.actions.map((action) => <button className={selectedAction === action ? "is-active" : ""} key={action} onClick={() => setSelectedAction(action)}><span>ACCESS</span>{action}<small>{selectedAction === action ? "SELECTED // PREVIEW READY" : "OPEN MODULE"}</small></button>)}</div>
      )}
      <footer className="room-footer"><b>HOODED PRIVATE NETWORK</b><span>PREVIEW MODE // NO LIVE TRANSACTIONS</span></footer>
    </div>
  );
}
