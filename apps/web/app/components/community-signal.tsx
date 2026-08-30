"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

type SignalMessage = {
  id: string;
  author: string;
  body: string;
  createdAt: string;
};

const CREED_MESSAGES: SignalMessage[] = [
  { id: "creed-1", author: "THE SOCIETY", body: "No hero builds alone.", createdAt: "CREED // I" },
  { id: "creed-2", author: "THE BUILDERS", body: "Every utility is built in the open, tested by the community, and strengthened by every worthy contribution.", createdAt: "CREED // II" },
  { id: "creed-3", author: "THE SIGNAL", body: "We leave the code better than we found it—and the door open for the next hero.", createdAt: "CREED // III" },
];

export function CommunitySignal() {
  const [messages, setMessages] = useState(CREED_MESSAGES);
  const [draft, setDraft] = useState("");
  const [networkState, setNetworkState] = useState("CONNECTING TO PRIVATE CHANNEL…");
  const [sending, setSending] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/community/messages", { cache: "no-store" });
      if (!response.ok) {
        setNetworkState(response.status === 403 ? "HOODED HERO VERIFICATION REQUIRED" : "CREED BROADCAST // CHAT OFFLINE");
        return;
      }
      const payload = await response.json() as { messages: SignalMessage[] };
      setMessages([...CREED_MESSAGES, ...payload.messages]);
      setNetworkState("LIVE // HERO-GATED CHANNEL");
    } catch {
      setNetworkState("CREED BROADCAST // CHAT OFFLINE");
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const interval = window.setInterval(() => void refresh(), 5_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [refresh]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const response = await fetch("/api/community/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID().replaceAll("-", "") },
        body: JSON.stringify({ body }),
      });
      if (!response.ok) {
        setNetworkState(response.status === 403 ? "HOODED HERO VERIFICATION REQUIRED" : "SIGNAL REJECTED // TRY AGAIN");
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
      <section className="creed-card" aria-label="The HoodedHeroes Creed">
        <span>THE HOODED HEROES CREED</span>
        <h3>WE BUILD<br /><b>TOGETHER.</b></h3>
        <blockquote>Every utility bearing our crest is built by the community, tested by the community, and forever improved by the community.</blockquote>
        <div className="creed-seal"><i>H</i><strong>OPEN CODE<br />SHARED POWER</strong></div>
      </section>
      <section className="signal-chat" aria-label="Community Signal live chat">
        <header><div><b className="live-dot" /> COMMUNITY SIGNAL</div><span>{networkState}</span></header>
        <div className="signal-feed" aria-live="polite">
          {messages.map((message) => <article key={message.id}><b>{message.author}</b><p>{message.body}</p><time>{message.createdAt}</time></article>)}
        </div>
        <form onSubmit={sendMessage}>
          <label><span className="sr-only">Send a message to the Community Signal</span><input value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={280} placeholder="TRANSMIT TO THE SOCIETY…" aria-label="Community message" /></label>
          <small>{draft.length}/280</small>
          <button disabled={!draft.trim() || sending}>{sending ? "SENDING…" : "SEND SIGNAL"}</button>
        </form>
      </section>
    </div>
  );
}
