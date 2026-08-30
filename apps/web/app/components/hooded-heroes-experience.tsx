"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { CommandCenter } from "./command-center";

type Hero = {
  name: string;
  codename: string;
  color: "red" | "blue" | "green" | "yellow" | "paper";
  image: string;
  power: string;
  role: string;
  quote: string;
};

const HEROES: Hero[] = [
  { name: "Inferno", codename: "HH-001", color: "red", image: "/heroes/inferno.png", power: "Thermal Forge", role: "Vanguard", quote: "Pressure makes the legend." },
  { name: "Volt", codename: "HH-002", color: "blue", image: "/heroes/volt.png", power: "Arc Relay", role: "Specialist", quote: "Every system has a current." },
  { name: "Pulse", codename: "HH-003", color: "green", image: "/heroes/pulse.png", power: "Kinetic Field", role: "Operative", quote: "Move the city. Move together." },
  { name: "Circuit", codename: "HH-004", color: "yellow", image: "/heroes/circuit.png", power: "Hard-Light Grid", role: "Engineer", quote: "Build what the night needs." },
  { name: "Phantom", codename: "HH-005", color: "paper", image: "/heroes/phantom.png", power: "Signal Veil", role: "Tactician", quote: "The best door is the one unseen." },
];

export function HoodedHeroesExperience() {
  const [connected, setConnected] = useState(false);
  const [selectedHero, setSelectedHero] = useState<Hero | null>(null);
  const [inCommandCenter, setInCommandCenter] = useState(false);

  if (inCommandCenter) {
    return <CommandCenter onExit={() => setInCommandCenter(false)} />;
  }

  return (
    <main className="comic-viewport">
      <div className="comic-cover">
        <div className="paper-grain" />
        <header className="cover-nav">
          <button className="nav-hood" aria-label="HoodedHeroes home" onClick={() => setSelectedHero(null)}><Image src="/brand/hoodedheroes-coin-emblem.png" alt="" fill sizes="6vw" priority /></button>
        </header>

        <section className="cover-copy" aria-labelledby="cover-title">
          <div className="cover-mark"><span className="cover-mark__hood" /><i /><i /><i /></div>
          <h1 id="cover-title"><span>Hooded</span><span>Heroes</span></h1>
          <div className="cover-tagline">Enter the society.<br />Build the next legend.</div>
        </section>

        <section className="hero-panels" aria-label="Meet the founding HoodedHeroes">
          {HEROES.map((hero, index) => (
            <button className={`hero-panel hero-panel--${hero.color}`} key={hero.name} onClick={() => setSelectedHero(hero)} aria-label={`Meet ${hero.name}`}>
              <span className="panel-burst" />
              <Image src={hero.image} alt={`${hero.name}, an original HoodedHero`} fill sizes="22vw" priority={index < 3} />
              <span className="hero-label"><small>{hero.codename}</small><strong>{hero.name}</strong></span>
            </button>
          ))}
        </section>

        <button className="restricted-door" aria-label="Enter the Society headquarters" onClick={() => setInCommandCenter(true)}>
          <div className="door-sign">Headquarters<br />Access restricted</div>
          <div className="door-frame"><span className="door-hood" /><i className="door-eye door-eye--left" /><i className="door-eye door-eye--right" /></div>
          <span className="door-action">Enter Society →</span>
        </button>

        <button className={`wallet-card ${connected ? "wallet-card--connected" : ""}`} onClick={() => setConnected((value) => !value)}>
          <span className="wallet-icon"><i /></span>
          <span className="wallet-copy"><strong>{connected ? "WALLET CONNECTED" : "CONNECT WALLET"}</strong><small>{connected ? "PREVIEW CLEARANCE // 0x7A2…91F" : "ENTER WITH 25,000 HERO"}</small></span>
        </button>

        <div className="genesis-counter"><span className="mini-hoods"><i /><i /><i /></span><b /><div><strong>3,000</strong><small>Genesis Heroes</small></div></div>
        <Link className="genesis-launch-link" href="/launch/hoodedheroes-hero-genesis"><span>$HERO GENESIS</span><b>VIEW PUBLIC VESTIBULE →</b></Link>
        <div className="corner-copy">ROBINHOOD CHAIN // SEASON 00 // PROTOTYPE</div>

        {selectedHero && (
          <div className="cover-modal" role="dialog" aria-modal="true" aria-label={`${selectedHero.name} dossier`}>
            <button className="modal-close" onClick={() => setSelectedHero(null)} aria-label="Close panel">×</button>
            <HeroDossier hero={selectedHero} />
          </div>
        )}
      </div>
    </main>
  );
}

function HeroDossier({ hero }: { hero: Hero }) {
  return (
    <div className={`dossier dossier--${hero.color}`}>
      <div className="dossier-art"><Image src={hero.image} alt="" fill sizes="45vw" /></div>
      <div className="dossier-copy"><span>{`${hero.codename} // FOUNDING FILE`}</span><h2>{hero.name}</h2><blockquote>“{hero.quote}”</blockquote><dl><div><dt>Origin role</dt><dd>{hero.role}</dd></div><div><dt>Signature power</dt><dd>{hero.power}</dd></div><div><dt>Genesis status</dt><dd>Unassigned</dd></div></dl><button>VIEW HERO CLASS</button></div>
    </div>
  );
}
