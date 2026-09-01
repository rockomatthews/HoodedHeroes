"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

const CHANNELS = [
  { id: "society", label: "SOCIETY SIGNAL", count: "ALL HEROES" },
  { id: "builders", label: "BUILDERS LOUNGE", count: "CODE + TESTS" },
  { id: "launch-review", label: "LAUNCH REVIEW", count: "PEER GATED" },
  { id: "house-relay", label: "HOUSE RELAY", count: "SIX HOUSES" },
] as const;

type ChannelId = (typeof CHANNELS)[number]["id"];
type SignalMessage = { id: string; author: string; body: string; createdAt: string };
type SignalActivity = { id: string; actor: string; action: string; channel: string; createdAt: string };

const CREED_MESSAGES: SignalMessage[] = [
  { id: "creed-1", author: "THE SOCIETY", body: "No hero builds alone.", createdAt: "CREED // I" },
  { id: "creed-2", author: "THE BUILDERS", body: "Every utility is built in the open, tested by the community, and strengthened by every worthy contribution.", createdAt: "CREED // II" },
  { id: "creed-3", author: "THE SIGNAL", body: "We leave the code better than we found it—and the door open for the next hero.", createdAt: "CREED // III" },
];

const CHANNEL_INTROS: Record<ChannelId, SignalMessage[]> = {
  society: CREED_MESSAGES,
  builders: [{ id: "builders-intro", author: "CODE BAZAAR", body: "Share reproducible evidence, ask for review, and leave every module stronger than you found it.", createdAt: "PINNED" }],
  "launch-review": [{ id: "launch-intro", author: "LAUNCH BAY", body: "Review manifests, simulations, fees, disclosures, and mainnet-fork evidence before any owner canary advances.", createdAt: "PINNED" }],
  "house-relay": [{ id: "houses-intro", author: "SIX-HOUSE RELAY", body: "Coordinate missions across every house. Rivalry ends where the city needs all of us.", createdAt: "PINNED" }],
};

const SYSTEM_ACTIVITY: SignalActivity[] = [
  { id: "activity-creed", actor: "SYSTEM", action: "pinned the HOODED Creed", channel: "SOCIETY", createdAt: "NOW" },
  { id: "activity-build", actor: "CODE BAZAAR", action: "verified the LaunchManifest test suite", channel: "BUILDERS", createdAt: "VERIFIED" },
  { id: "activity-launch", actor: "LAUNCH BAY", action: "sealed the v1 review pipeline", channel: "REVIEW", createdAt: "READY" },
];

export function CommunitySignal() {
  const [activeChannel, setActiveChannel] = useState<ChannelId>("society");
  const [messages, setMessages] = useState(CREED_MESSAGES);
  const [activity, setActivity] = useState(SYSTEM_ACTIVITY);
  const [draft, setDraft] = useState("");
  const [networkState, setNetworkState] = useState("CONNECTING TO PRIVATE CHANNEL…");
  const [sending, setSending] = useState(false);
  const [pollingEnabled, setPollingEnabled] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/community/messages?channel=${activeChannel}`, { cache: "no-store" });
      if (!response.ok) {
        setNetworkState(response.status === 403 ? "GENESIS HERO VERIFICATION REQUIRED" : "CREED BROADCAST // CHAT OFFLINE");
        setPollingEnabled(false);
        return;
      }
      const payload = await response.json() as { messages: SignalMessage[]; activity: SignalActivity[] };
      setMessages([...CHANNEL_INTROS[activeChannel], ...payload.messages]);
      setActivity(payload.activity.length ? payload.activity : SYSTEM_ACTIVITY);
      setNetworkState("LIVE // HOODED-GATED NETWORK");
    } catch {
      setNetworkState("CREED BROADCAST // CHAT OFFLINE");
    }
  }, [activeChannel]);

  useEffect(() => {
    if (!pollingEnabled) return;
    const initial = window.setTimeout(() => void refresh(), 0);
    const interval = window.setInterval(() => void refresh(), 5_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [pollingEnabled, refresh]);

  function selectChannel(channel: ChannelId) {
    setActiveChannel(channel);
    setMessages(CHANNEL_INTROS[channel]);
    setDraft("");
    setNetworkState("CONNECTING TO PRIVATE CHANNEL…");
    setPollingEnabled(true);
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const response = await fetch("/api/community/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID().replaceAll("-", "") },
        body: JSON.stringify({ body, channel: activeChannel }),
      });
      if (!response.ok) {
        setNetworkState(response.status === 403 ? "GENESIS HERO VERIFICATION REQUIRED" : "SIGNAL REJECTED // TRY AGAIN");
        return;
      }
      setDraft("");
      await refresh();
    } catch {
      setNetworkState("SIGNAL NETWORK UNREACHABLE");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="community-signal-room">
      <section className="creed-card" aria-label="The HOODED Creed">
        <span>THE HOODED CREED</span>
        <h3>WE BUILD<br /><b>TOGETHER.</b></h3>
        <blockquote>Every utility bearing our crest is built, tested, and forever improved by the community.</blockquote>
        <nav className="signal-channels" aria-label="Community Signal channels">
          {CHANNELS.map((channel) => <button key={channel.id} className={activeChannel === channel.id ? "is-active" : ""} onClick={() => selectChannel(channel.id)}><b>{channel.label}</b><small>{channel.count}</small></button>)}
        </nav>
      </section>

      <section className="signal-chat" aria-label="Community Signal live chat">
        <header><div><b className="live-dot" /> {CHANNELS.find((channel) => channel.id === activeChannel)?.label}</div><span>{networkState}</span></header>
        <div className="signal-feed" aria-live="polite">
          {messages.map((message) => <article key={message.id}><b>{message.author}</b><p>{message.body}</p><time>{message.createdAt}</time></article>)}
        </div>
        <form onSubmit={sendMessage}>
          <label><span className="sr-only">Send a message to the Community Signal</span><input value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={280} placeholder="TRANSMIT TO THE SOCIETY…" aria-label="Community message" /></label>
          <small>{draft.length}/280</small>
          <button disabled={!draft.trim() || sending}>{sending ? "SENDING…" : "SEND SIGNAL"}</button>
        </form>
      </section>

      <aside className="signal-activity" aria-label="Live society activity">
        <header><b className="live-dot" /> NETWORK ACTIVITY</header>
        <div>{activity.map((item) => <article key={item.id}><b>{item.actor}</b><p>{item.action}</p><span>{item.channel}</span><time>{item.createdAt}</time></article>)}</div>
        <footer><b>{activity.length}</b><span>RECENT SIGNALS</span><small>CONTRACT-FIRST<br />IDENTITY</small></footer>
      </aside>
    </div>
  );
}
