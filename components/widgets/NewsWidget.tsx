"use client";
import { useCallback, useEffect, useState } from "react";
import { X, ExternalLink, Newspaper } from "lucide-react";
import { useWidgetSettings, useWidgetRefresh } from "@/components/WidgetWrapper";

interface NewsConfig { feeds?: string[]; showImages?: boolean; layout?: "cards" | "compact" }

const DEFAULT_FEEDS = ["https://feeds.bbci.co.uk/news/world/rss.xml"];

interface RssItem { title: string; link: string; pubDate?: string; image?: string; contentSnippet?: string }
interface Article extends RssItem { source: string }

function hostOf(url: string) { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; } }
function timeAgo(iso?: string) {
  if (!iso) return "";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export default function NewsWidget({ config, onConfigChange }: { config: NewsConfig; onConfigChange?: (c: Record<string, unknown>) => void }) {
  const feeds = config.feeds?.length ? config.feeds : DEFAULT_FEEDS;
  const showImages = config.showImages !== false;
  const layout = config.layout || "cards";
  const [articles, setArticles] = useState<Article[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [available, setAvailable] = useState<{ url: string; title: string }[]>([]);

  const patch = (p: NewsConfig) => onConfigChange?.({ feeds, showImages, layout, ...p });

  const load = useCallback(() => {
    if (!feeds.length) { setArticles([]); return; }
    setLoading(true); setError("");
    Promise.all(feeds.map((url) =>
      fetch(`/api/rss?url=${encodeURIComponent(url)}`, { cache: "no-store" })
        .then((r) => r.json())
        .then((j) => (j.items as RssItem[] || []).map((it) => ({ ...it, source: j.title || hostOf(url) })))
        .catch(() => [] as Article[])
    )).then((lists) => {
      const merged = lists.flat().filter((a) => a.title && a.link);
      merged.sort((a, b) => new Date(b.pubDate || 0).getTime() - new Date(a.pubDate || 0).getTime());
      setArticles(merged.slice(0, 40));
    }).catch((e) => setError(String(e))).finally(() => setLoading(false));
  }, [feeds]);

  useEffect(() => { load(); }, [load]);
  useWidgetRefresh(load);

  // Offer feeds already configured in RSS widgets across the dashboard.
  useEffect(() => { fetch("/api/feeds").then((r) => r.json()).then((j) => setAvailable(j.rss || [])).catch(() => {}); }, []);

  useWidgetSettings(
    <>
      <div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Feeds</div>
        {feeds.map((f) => (
          <div key={f} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, fontSize: 11, color: "var(--text-secondary)", padding: "2px 0" }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{hostOf(f) || f}</span>
            <button onClick={() => patch({ feeds: feeds.filter((x) => x !== f) })} style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", padding: 0, display: "flex", flexShrink: 0 }}><X size={12} /></button>
          </div>
        ))}
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { const u = draft.trim(); if (u && !feeds.includes(u)) { patch({ feeds: [...feeds, u] }); setDraft(""); } } }} placeholder="https://site.com/feed.xml" style={{ flex: 1, minWidth: 0, fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-base)", color: "var(--text-primary)", outline: "none" }} />
          <button onClick={() => { const u = draft.trim(); if (u && !feeds.includes(u)) { patch({ feeds: [...feeds, u] }); setDraft(""); } }} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer" }}>Add</button>
        </div>
      </div>
      {available.some((a) => !feeds.includes(a.url)) && (
        <div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Add a feed from your RSS widgets</div>
          <select value="" onChange={(e) => { if (e.target.value && !feeds.includes(e.target.value)) patch({ feeds: [...feeds, e.target.value] }); }} style={{ width: "100%", fontSize: 12, padding: "5px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-base)", color: "var(--text-primary)", outline: "none" }}>
            <option value="">— pick a feed —</option>
            {available.filter((a) => !feeds.includes(a.url)).map((a) => <option key={a.url} value={a.url}>{a.title}</option>)}
          </select>
        </div>
      )}
      <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, color: "var(--text-secondary)" }}>
        Show images
        <input type="checkbox" checked={showImages} onChange={(e) => patch({ showImages: e.target.checked })} />
      </label>
      <div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Layout</div>
        <div style={{ display: "flex", gap: 6 }}>
          {(["cards", "compact"] as const).map((l) => (
            <button key={l} onClick={() => patch({ layout: l })} style={{ flex: 1, fontSize: 11, padding: "4px 0", borderRadius: 6, border: "1px solid var(--border)", cursor: "pointer", textTransform: "capitalize", background: layout === l ? "var(--accent)" : "transparent", color: layout === l ? "#fff" : "var(--text-secondary)" }}>{l}</button>
          ))}
        </div>
      </div>
    </>
  );

  if (!feeds.length) return <div style={{ color: "var(--text-muted)", fontSize: 12, textAlign: "center", paddingTop: 20 }}>Open settings (gear) and add a news feed.</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 8, overflow: "auto" }}>
      {error && <div style={{ fontSize: 11, color: "var(--danger)" }}>{error}</div>}
      {loading && articles.length === 0 && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Loading…</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {articles.map((a, i) => (
          <a key={i} href={a.link} target="_blank" rel="noopener noreferrer" style={{ display: "flex", gap: 10, padding: layout === "cards" ? 8 : "5px 6px", borderRadius: 10, border: "1px solid var(--border)", background: "rgba(255,255,255,0.02)", textDecoration: "none" }}>
            {showImages && layout === "cards" && a.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.image} alt="" loading="lazy" style={{ width: 84, height: 84, objectFit: "cover", borderRadius: 8, flexShrink: 0, background: "var(--bg-base)" }} onError={(e) => { (e.currentTarget.style.display = "none"); }} />
            )}
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: 3 }}>
              <span style={{ fontSize: layout === "cards" ? 13 : 12, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: layout === "cards" ? 3 : 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{a.title}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: "var(--text-muted)" }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 140 }}>{a.source}</span>
                <span>· {timeAgo(a.pubDate)}</span>
                <ExternalLink size={9} style={{ flexShrink: 0 }} />
              </span>
            </div>
          </a>
        ))}
        {!loading && articles.length === 0 && !error && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, color: "var(--text-muted)", paddingTop: 16 }}>
            <Newspaper size={20} /><span style={{ fontSize: 12 }}>No headlines.</span>
          </div>
        )}
      </div>
    </div>
  );
}
