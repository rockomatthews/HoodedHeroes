"use client";

import Image from "next/image";
import { useState } from "react";
import commandCenterArt from "../../../../art/concepts/02-secret-command-center.png";
import { CodeBazaarWorkbench } from "./code-bazaar-workbench";
import { CommunitySignal } from "./community-signal";
import { LaunchBayWorkbench } from "./launch-bay-workbench";

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
    id: "community-signal", label: "Community Signal", eyebrow: "THE HOODED HEROES CREED // LIVE SOCIETY CHAT", accent: "yellow",
    summary: "The central signal belongs to every builder. Read the Creed, meet the society, and coordinate the next community-built utility.",
    stats: [["Channel", "CREED-01"], ["Network", "HERO-GATED"], ["Purpose", "BUILD TOGETHER"]],
    actions: ["Read the Creed", "Open live chat", "Builder roll call"],
  },
  "mission-deck": {
    id: "mission-deck", label: "Mission Deck", eyebrow: "OPERATIONS // LIVE BRIEFINGS", accent: "red",
    summary: "Choose deterministic city operations, spend energy, and submit replayable action traces for signed scoring.",
    stats: [["Available", "06"], ["Energy", "82/100"], ["Daily bonus", "+15 REP"]],
    actions: ["Power Grid", "Drone Dash", "Cipher Break"],
  },
  "code-bazaar": {
    id: "code-bazaar", label: "Code Bazaar", eyebrow: "PRIVATE BUILDER LAB // ISOLATED", accent: "blue",
    summary: "A members-only workshop for proposing, testing, reviewing, and improving approved launcher modules without touching production systems.",
    stats: [["Open modules", "12"], ["Tests today", "148"], ["Review queue", "04"]],
    actions: ["Launcher Core", "Vesting Module", "Liquidity Lock"],
  },
  assembly: {
    id: "assembly", label: "Assembly", eyebrow: "GOVERNANCE // SIX HOUSES", accent: "green",
    summary: "Review proposals, debate changes, and cast hero-weighted votes after technical and security review.",
    stats: [["Active votes", "03"], ["Quorum", "61%"], ["Next close", "18H"]],
    actions: ["Proposal 018", "Security Council", "House Forum"],
  },
  "launch-bay": {
    id: "launch-bay", label: "Launch Bay", eyebrow: "AUDITED RELEASE PIPELINE", accent: "yellow",
    summary: "Move approved fixed-supply projects through reproducible builds, audit gates, contribution caps, vesting, and locked liquidity.",
    stats: [["In review", "02"], ["Audited", "05"], ["Live", "00"]],
    actions: ["New proposal", "Audit trail", "Launch checklist"],
  },
  "stock-vault": {
    id: "stock-vault", label: "Stock Token Vault", eyebrow: "ELIGIBILITY-GATED REWARDS", accent: "purple",
    summary: "View funded Stock Token pools and jurisdiction-aware claim eligibility. Prohibited wallets receive no substitute award.",
    stats: [["Assets", "06"], ["Claim window", "LOCKED"], ["Vault status", "FUNDED"]],
    actions: ["Eligibility", "Asset pools", "Claim history"],
  },
  workshop: {
    id: "workshop", label: "Hero Workshop", eyebrow: "CRAFT // EQUIP // UPGRADE", accent: "orange",
    summary: "Craft strategic equipment, configure abilities, and reinvest Salary Credits into earned progression.",
    stats: [["Blueprints", "09"], ["Gear slots", "02"], ["Credits", "3,450"]],
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
    id: "vault", label: "My Vault", eyebrow: "ASSETS // RECEIPTS", accent: "purple",
    summary: "Inspect your HERO balance, earned credits, equipment, claim receipts, and season rewards in one place.",
    stats: [["HERO", "125,000"], ["Credits", "3,450"], ["Items", "07"]],
    actions: ["Balances", "Equipment", "Reward receipts"],
  },
  profile: {
    id: "profile", label: "Hero Profile", eyebrow: "HH-0001 // INITIATE", accent: "yellow",
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

export function CommandCenter({ onExit }: { onExit: () => void }) {
  const [activeRoom, setActiveRoom] = useState<RoomId | null>(null);
  const active = activeRoom ? ROOMS[activeRoom] : null;

  return (
    <section className="command-viewport" aria-label="HoodedHeroes Command Center">
      <div className="command-stage">
        <Image className="command-art" src={commandCenterArt} alt="The HoodedHeroes Command Center, with interactive rooms arranged around a six-house city map" fill priority sizes="100vw" />
        <button className="community-signal-beacon" aria-label="Open Community Signal and HoodedHeroes Creed" onClick={() => setActiveRoom("community-signal")}>
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
      ) : (
        <div className="room-actions">{room.actions.map((action) => <button className={selectedAction === action ? "is-active" : ""} key={action} onClick={() => setSelectedAction(action)}><span>ACCESS</span>{action}<small>{selectedAction === action ? "SELECTED // PREVIEW READY" : "OPEN MODULE"}</small></button>)}</div>
      )}
      <footer className="room-footer"><b>HOODEDHEROES PRIVATE NETWORK</b><span>PREVIEW MODE // NO LIVE TRANSACTIONS</span></footer>
    </div>
  );
}
