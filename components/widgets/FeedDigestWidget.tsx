"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Newspaper } from "lucide-react";
import { useWidgetSettings, useWidgetRefresh } from "@/components/WidgetWrapper";
import {
  discoverModels, DEFAULT_CLAUDE_MODEL,
  streamChat, type ModelOption,
} from "@/lib/ai";

interface DigestConfig {
  model?: string;
  rssUrls?: string[];      // selected RSS + News feed URLs
  subreddits?: string[];   // selected subreddits
  lastText?: string; lastAt?: number;
  // legacy (single-source) — migrated on first interaction:
  source?: "rss" | "reddit"; rssUrl?: string; subreddit?: string;
}

interface RssItem { title: string; contentSnippet?: string }
interface RedditPost { title: string; score: number; numComments: number; selftext?: string }
interface Discovered { rss: { url: string; title: string }[]; news: { url: string; title: string }[]; reddit: { subreddit: string }[] }

function hostOf(url: string) { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; } }

export default function FeedDigestWidget({ config, onConfigChange }: { config: DigestConfig; onConfigChange?: (c: Record<string, unknown>) => void }) {
  // Selections (with migration from the old single-feed config shape).
  const selectedRss = config.rssUrls ?? (config.rssUrl ? [config.rssUrl] : []);
  const selectedSubs = config.subreddits ?? (config.subreddit ? [config.subreddit] : []);

  const [models, setModels] = useState<ModelOption[]>([]);
  const [model, setModel] = useState(config.model || DEFAULT_CLAUDE_MODEL);
  const [text, setText] = useState(config.lastText || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [disc, setDisc] = useState<Discovered>({ rss: [], news: [], reddit: [] });
  const [manualFeed, setManualFeed] = useState("");
  const [manualSub, setManualSub] = useState("");
  const ollamaUrl = useRef("");

  // Always carry selections + persisted result through every patch.
  const patch = (p: DigestConfig) =>
    onConfigChange?.({ model, rssUrls: selectedRss, subreddits: selectedSubs, lastText: config.lastText, lastAt: config.lastAt, ...p });

  useEffect(() => {
    (async () => {
      const { models: all, ollamaUrl: url } = await discoverModels();
      ollamaUrl.current = url;
      setModels(all);
      if (all.length && !all.some((m) => m.id === (config.model || model))) setModel(all[0].id);
      fetch("/api/feeds").then((r) => r.json()).then((j) => setDisc({ rss: j.rss || [], news: j.news || [], reddit: j.reddit || [] })).catch(() => {});
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Known feeds = discovered RSS + News (deduped) ∪ anything already selected manually.
  const knownFeeds = (() => {
    const map = new Map<string, string>();
    for (const f of [...disc.rss, ...disc.news]) if (!map.has(f.url)) map.set(f.url, f.title);
    for (const u of selectedRss) if (!map.has(u)) map.set(u, hostOf(u));
    return Array.from(map, ([url, title]) => ({ url, title }));
  })();
  const knownSubs = (() => {
    const set = new Set<string>(disc.reddit.map((r) => r.subreddit));
    for (const s of selectedSubs) set.add(s);
    return Array.from(set);
  })();

  const toggleFeed = (url: string) =>
    patch({ rssUrls: selectedRss.includes(url) ? selectedRss.filter((u) => u !== url) : [...selectedRss, url] });
  const toggleSub = (sub: string) =>
    patch({ subreddits: selectedSubs.includes(sub) ? selectedSubs.filter((s) => s !== sub) : [...selectedSubs, sub] });

  const gather = useCallback(async (): Promise<{ sources: number; body: string } | null> => {
    const parts: string[] = [];
    await Promise.all([
      ...selectedRss.map(async (url) => {
        try {
          const j = await fetch(`/api/rss?url=${encodeURIComponent(url)}`, { cache: "no-store" }).then((r) => r.json());
          const items = (j.items as RssItem[] || []).slice(0, 8);
          if (items.length) parts.push(`## ${j.title || hostOf(url)}\n` + items.map((i) => `- ${i.title}${i.contentSnippet ? ` — ${i.contentSnippet.slice(0, 120)}` : ""}`).join("\n"));
        } catch { /* skip this feed */ }
      }),
      ...selectedSubs.map(async (sub) => {
        try {
          const j = await fetch(`/api/reddit?subreddit=${encodeURIComponent(sub)}&sort=top&limit=12`, { cache: "no-store" }).then((r) => r.json());
          const posts = (j.posts as RedditPost[] || []).slice(0, 8);
          if (posts.length) parts.push(`## r/${sub}\n` + posts.map((p) => `- [${p.score}⬆] ${p.title}`).join("\n"));
        } catch { /* skip this sub */ }
      }),
    ]);
    if (!parts.length) return null;
    return { sources: selectedRss.length + selectedSubs.length, body: parts.join("\n\n") };
  }, [selectedRss, selectedSubs]);

  const generate = useCallback(async () => {
    if (loading) return;
    setLoading(true); setError(""); setText("");
    try {
      if (!selectedRss.length && !selectedSubs.length) { setError("Pick some feeds in settings (gear)."); setLoading(false); return; }
      const data = await gather();
      if (!data) { setError("No items fetched. Check the feeds / Reddit credentials."); setLoading(false); return; }
      const system =
        "You are a news editor. The following are headlines grouped by source (## headers). " +
        "Write a single tight digest of 4-7 bullet points across ALL sources, grouping related stories and surfacing what's most important or interesting. " +
        "Plain text, one bullet per line starting with '•'. No preamble, no per-source headers.";
      let acc = "";
      await streamChat(
        {
          model,
          provider: models.find((m) => m.id === model)?.provider,
          system,
          ollamaUrl: ollamaUrl.current,
          messages: [{ role: "user", content: `Sources (${data.sources}):\n\n${data.body}` }],
        },
        (t) => { acc += t; setText((prev) => prev + t); }
      );
      onConfigChange?.({ model, rssUrls: selectedRss, subreddits: selectedSubs, lastText: acc, lastAt: Date.now() });
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setLoading(false);
    }
  }, [gather, loading, model, models, selectedRss, selectedSubs, onConfigChange]);

  useWidgetRefresh(() => generate());

  const allFeedsSelected = knownFeeds.length > 0 && knownFeeds.every((f) => selectedRss.includes(f.url));
  const allSubsSelected = knownSubs.length > 0 && knownSubs.every((s) => selectedSubs.includes(s));

  const checkRow = (label: string, checked: boolean, onToggle: () => void) => (
    <label key={label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-secondary)", padding: "2px 0", cursor: "pointer" }}>
      <input type="checkbox" checked={checked} onChange={onToggle} style={{ flexShrink: 0 }} />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
    </label>
  );

  useWidgetSettings(
    <>
      <div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Model</div>
        <select value={model} onChange={(e) => { setModel(e.target.value); patch({ model: e.target.value }); }} style={{ width: "100%", fontSize: 12, padding: "5px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-base)", color: "var(--text-primary)", outline: "none" }}>
          {models.length === 0 && <option>No models — configure AI in Setup</option>}
          {models.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
      </div>

      <div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>RSS &amp; News feeds</div>
        {knownFeeds.length > 0 && checkRow(
          allFeedsSelected ? "Deselect all" : "Select all",
          allFeedsSelected,
          () => patch({ rssUrls: allFeedsSelected ? [] : knownFeeds.map((f) => f.url) })
        )}
        {knownFeeds.map((f) => checkRow(f.title, selectedRss.includes(f.url), () => toggleFeed(f.url)))}
        {knownFeeds.length === 0 && <div style={{ fontSize: 10, color: "var(--text-muted)" }}>No RSS/News widgets found — add a feed below.</div>}
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          <input value={manualFeed} onChange={(e) => setManualFeed(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { const u = manualFeed.trim(); if (u && !selectedRss.includes(u)) { patch({ rssUrls: [...selectedRss, u] }); setManualFeed(""); } } }} placeholder="https://site.com/feed.xml" style={{ flex: 1, minWidth: 0, fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-base)", color: "var(--text-primary)", outline: "none" }} />
          <button onClick={() => { const u = manualFeed.trim(); if (u && !selectedRss.includes(u)) { patch({ rssUrls: [...selectedRss, u] }); setManualFeed(""); } }} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer" }}>Add</button>
        </div>
      </div>

      <div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Subreddits</div>
        {knownSubs.length > 0 && checkRow(
          allSubsSelected ? "Deselect all" : "Select all",
          allSubsSelected,
          () => patch({ subreddits: allSubsSelected ? [] : knownSubs })
        )}
        {knownSubs.map((s) => checkRow(`r/${s}`, selectedSubs.includes(s), () => toggleSub(s)))}
        {knownSubs.length === 0 && <div style={{ fontSize: 10, color: "var(--text-muted)" }}>No Reddit widgets found — add one below.</div>}
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          <input value={manualSub} onChange={(e) => setManualSub(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { const s = manualSub.trim().replace(/^r\//, ""); if (s && !selectedSubs.includes(s)) { patch({ subreddits: [...selectedSubs, s] }); setManualSub(""); } } }} placeholder="technology" style={{ flex: 1, minWidth: 0, fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-base)", color: "var(--text-primary)", outline: "none" }} />
          <button onClick={() => { const s = manualSub.trim().replace(/^r\//, ""); if (s && !selectedSubs.includes(s)) { patch({ subreddits: [...selectedSubs, s] }); setManualSub(""); } }} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer" }}>Add</button>
        </div>
      </div>
    </>
  );

  const nSel = selectedRss.length + selectedSubs.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 8 }}>
      {!text && !loading && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, color: "var(--text-muted)" }}>
          <Newspaper size={22} color="var(--accent)" />
          <button onClick={generate} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, padding: "8px 16px", borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer" }}>
            <Newspaper size={13} /> Summarize {nSel > 0 ? `${nSel} source${nSel > 1 ? "s" : ""}` : "feeds"}
          </button>
          {error && <div style={{ fontSize: 11, color: "var(--danger)", maxWidth: 280, textAlign: "center" }}>{error}</div>}
        </div>
      )}
      {(text || loading) && (
        <>
          <div style={{ flex: 1, overflow: "auto", fontSize: 13, lineHeight: 1.6, color: "var(--text-primary)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {text}{loading && <span style={{ opacity: 0.5 }}>▋</span>}
          </div>
          {error && <div style={{ fontSize: 11, color: "var(--danger)" }}>{error}</div>}
          <button onClick={generate} disabled={loading} style={{ alignSelf: "flex-end", display: "flex", alignItems: "center", gap: 5, fontSize: 11, padding: "3px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--accent)", cursor: loading ? "default" : "pointer", opacity: loading ? 0.5 : 1 }}>
            <Newspaper size={11} /> Refresh
          </button>
        </>
      )}
    </div>
  );
}
