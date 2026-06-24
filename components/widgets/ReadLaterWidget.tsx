"use client";
import { useEffect, useState } from "react";
import { ExternalLink, Check, Trash2, Plus } from "lucide-react";

interface Item { url: string; title: string; added: number; done: boolean }
const KEY = "dashboard_read_later";

function load(): Item[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}

export default function ReadLaterWidget() {
  const [items, setItems] = useState<Item[]>([]);
  const [url, setUrl] = useState("");

  useEffect(() => { setItems(load()); }, []);
  const persist = (next: Item[]) => { setItems(next); localStorage.setItem(KEY, JSON.stringify(next)); };

  const add = () => {
    let u = url.trim();
    if (!u) return;
    if (!/^https?:\/\//i.test(u)) u = "https://" + u;
    let title = u;
    try { title = new URL(u).hostname.replace(/^www\./, "") + new URL(u).pathname.replace(/\/$/, ""); } catch {}
    persist([{ url: u, title, added: Date.now(), done: false }, ...items]);
    setUrl("");
  };

  const toggle = (i: number) => persist(items.map((it, k) => k === i ? { ...it, done: !it.done } : it));
  const remove = (i: number) => persist(items.filter((_, k) => k !== i));

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 8 }}>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") add(); }}
          placeholder="Paste a URL to read later…"
          style={{ flex: 1, minWidth: 0, background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 10px", color: "var(--text-primary)", fontSize: 12, outline: "none" }}
        />
        <button onClick={add} style={{ display: "flex", alignItems: "center", padding: "7px 12px", borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer" }}><Plus size={14} /></button>
      </div>
      <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: 5 }}>
        {items.length === 0 && <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", paddingTop: 16 }}>Nothing saved yet.</div>}
        {items.map((it, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", opacity: it.done ? 0.5 : 1 }}>
            <button onClick={() => toggle(i)} title={it.done ? "Mark unread" : "Mark read"} style={{ display: "flex", background: "none", border: "1px solid var(--border)", borderRadius: 5, padding: 3, color: it.done ? "var(--success)" : "var(--text-muted)", cursor: "pointer" }}><Check size={11} /></button>
            <a href={it.url} target="_blank" rel="noopener noreferrer" style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--text-primary)", textDecoration: it.done ? "line-through" : "none", overflow: "hidden" }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.title}</span>
              <ExternalLink size={10} color="var(--text-muted)" style={{ flexShrink: 0 }} />
            </a>
            <button onClick={() => remove(i)} style={{ display: "flex", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 2 }}><Trash2 size={12} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
