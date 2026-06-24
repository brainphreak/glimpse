"use client";
import { useState } from "react";
import { X } from "lucide-react";

const WIDGET_TYPES = [
  { type: "clock",          label: "Clock",          desc: "Live clock and date" },
  { type: "weather",        label: "Weather",        desc: "Current weather and forecast" },
  { type: "calendar",       label: "Calendar",       desc: "Google Calendar events" },
  { type: "gmail",          label: "Gmail",          desc: "Recent emails and unread count" },
  { type: "notes",          label: "Notes",          desc: "Sticky notes pinboard" },
  { type: "links",          label: "Links",          desc: "Bookmarks and quick links" },
  { type: "rss",            label: "RSS Feed",       desc: "Any RSS or Atom feed" },
  { type: "reddit",         label: "Reddit",         desc: "Subreddit posts" },
  { type: "server-monitor", label: "Server Monitor", desc: "Health checks and SSH shortcuts" },
  { type: "claude",         label: "AI Chat",        desc: "Streaming chat — Claude or local Ollama, web search & images" },
  { type: "daily-briefing", label: "Daily Briefing", desc: "AI summary of your calendar, email and headlines" },
  { type: "feed-digest",    label: "Feed Digest",    desc: "AI summary of an RSS feed or subreddit" },
  { type: "ai-terminal",    label: "AI Terminal",    desc: "Terminal-styled AI chat (Claude or Ollama)" },
  { type: "terminal",       label: "Terminal",       desc: "Browser terminal — runs claude CLI or bash on the server" },
  { type: "world-clocks",   label: "World Clocks",   desc: "Time across multiple time zones" },
  { type: "crypto",         label: "Crypto Ticker",  desc: "Live crypto prices (CoinGecko)" },
  { type: "stocks",         label: "Stock Ticker",   desc: "Live stock / ETF / index prices (Yahoo Finance)" },
  { type: "news",           label: "News",           desc: "Headline cards with images from RSS feeds" },
  { type: "github",         label: "GitHub",         desc: "Notifications and your open pull requests" },
  { type: "docker",         label: "Docker",         desc: "Container status on the server" },
  { type: "sys-health",     label: "System Health",  desc: "CPU load, memory and uptime of the host" },
  { type: "read-later",     label: "Read Later",     desc: "Quick-save links to read later (this browser)" },
  { type: "html",           label: "Custom HTML",    desc: "Render arbitrary HTML/CSS in a widget" },
  { type: "image",          label: "Image / GIF",    desc: "Display any image or animated GIF by URL" },
  { type: "iframe",         label: "Iframe Embed",   desc: "Embed any website in a resizable frame" },
];

interface Props {
  onAdd: (type: string) => void;
  onClose: () => void;
}

export default function AddWidgetModal({ onAdd, onClose }: Props) {
  const [search, setSearch] = useState("");
  const filtered = WIDGET_TYPES.filter(
    (w) =>
      w.label.toLowerCase().includes(search.toLowerCase()) ||
      w.desc.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "var(--bg-widget)", border: "1px solid var(--border)", borderRadius: 14, padding: 24, width: 480, maxWidth: "90vw", maxHeight: "80vh", display: "flex", flexDirection: "column", gap: 16 }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>Add Widget</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}><X size={18} /></button>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search widgets…"
          autoFocus
          style={{ background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none" }}
        />
        <div style={{ overflow: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
          {filtered.map((w) => (
            <button
              key={w.type}
              onClick={() => { onAdd(w.type); onClose(); }}
              style={{ display: "flex", flexDirection: "column", gap: 2, padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "rgba(255,255,255,0.02)", cursor: "pointer", textAlign: "left", transition: "background 0.15s" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(88,166,255,0.1)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{w.label}</span>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{w.desc}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
