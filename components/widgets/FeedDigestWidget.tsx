"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Newspaper } from "lucide-react";
import { useWidgetSettings, useWidgetRefresh } from "@/components/WidgetWrapper";
import {
  discoverModels, DEFAULT_CLAUDE_MODEL,
  streamChat, type ModelOption,
} from "@/lib/ai";

type SourceKind = "rss" | "reddit";
interface DigestConfig { model?: string; source?: SourceKind; rssUrl?: string; subreddit?: string; lastText?: string; lastAt?: number }

interface RssItem { title: string; contentSnippet?: string }
interface RedditPost { title: string; score: number; numComments: number; selftext?: string }

export default function FeedDigestWidget({ config, onConfigChange }: { config: DigestConfig; onConfigChange?: (c: Record<string, unknown>) => void }) {
  const source: SourceKind = config.source || "rss";
  const [models, setModels] = useState<ModelOption[]>([]);
  const [model, setModel] = useState(config.model || DEFAULT_CLAUDE_MODEL);
  const [text, setText] = useState(config.lastText || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [feeds, setFeeds] = useState<{ rss: { url: string; title: string }[]; reddit: { subreddit: string }[] }>({ rss: [], reddit: [] });
  const ollamaUrl = useRef("");

  // Carry the persisted result through every patch so changing settings doesn't wipe the saved digest.
  const patch = (p: DigestConfig) => onConfigChange?.({ model, source, rssUrl: config.rssUrl, subreddit: config.subreddit, lastText: config.lastText, lastAt: config.lastAt, ...p });

  useEffect(() => {
    (async () => {
      const { models: all, ollamaUrl: url } = await discoverModels();
      ollamaUrl.current = url;
      setModels(all);
      if (all.length && !all.some((m) => m.id === (config.model || model))) setModel(all[0].id);
      fetch("/api/feeds").then((r) => r.json()).then(setFeeds).catch(() => {});
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const gather = useCallback(async (): Promise<{ label: string; body: string } | null> => {
    if (source === "rss") {
      if (!config.rssUrl) return null;
      const j = await fetch(`/api/rss?url=${encodeURIComponent(config.rssUrl)}`, { cache: "no-store" }).then((r) => r.json());
      if (j.error) throw new Error(j.error);
      const items = (j.items as RssItem[] || []).slice(0, 15);
      if (!items.length) return null;
      return { label: j.title || "feed", body: items.map((i, n) => `${n + 1}. ${i.title}${i.contentSnippet ? ` — ${i.contentSnippet.slice(0, 140)}` : ""}`).join("\n") };
    } else {
      const sub = config.subreddit || "all";
      const j = await fetch(`/api/reddit?subreddit=${encodeURIComponent(sub)}&sort=top&limit=20`, { cache: "no-store" }).then((r) => r.json());
      if (j.error) throw new Error(j.error);
      const posts = (j.posts as RedditPost[] || []).slice(0, 15);
      if (!posts.length) return null;
      return { label: `r/${sub}`, body: posts.map((p, n) => `${n + 1}. [${p.score}⬆ ${p.numComments}💬] ${p.title}${p.selftext ? ` — ${p.selftext.slice(0, 120)}` : ""}`).join("\n") };
    }
  }, [source, config.rssUrl, config.subreddit]);

  const generate = useCallback(async () => {
    if (loading) return;
    setLoading(true); setError(""); setText("");
    try {
      const data = await gather();
      if (!data) { setError(source === "rss" ? "Add a feed URL in settings." : "Add a subreddit in settings."); setLoading(false); return; }
      const system =
        "You are a news editor. Summarize the following feed items into a tight digest of 3-5 bullet points " +
        "grouping related stories and highlighting what's most important or interesting. Plain text, one bullet per line starting with '•'. No preamble.";
      let acc = "";
      await streamChat(
        {
          model,
          provider: models.find((m) => m.id === model)?.provider,
          system,
          ollamaUrl: ollamaUrl.current,
          messages: [{ role: "user", content: `Digest of ${data.label}:\n\n${data.body}` }],
        },
        (t) => { acc += t; setText((prev) => prev + t); }
      );
      // Persist the digest so it survives tab switches / reloads.
      onConfigChange?.({ model, source, rssUrl: config.rssUrl, subreddit: config.subreddit, lastText: acc, lastAt: Date.now() });
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setLoading(false);
    }
  }, [gather, loading, model, models, source, config.rssUrl, config.subreddit, onConfigChange]);

  useWidgetRefresh(() => generate());

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
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Source</div>
        <div style={{ display: "flex", gap: 6 }}>
          {(["rss", "reddit"] as SourceKind[]).map((s) => (
            <button key={s} onClick={() => patch({ source: s })} style={{ flex: 1, fontSize: 11, padding: "4px 0", borderRadius: 6, border: "1px solid var(--border)", cursor: "pointer", textTransform: "capitalize", background: source === s ? "var(--accent)" : "transparent", color: source === s ? "#fff" : "var(--text-secondary)" }}>{s}</button>
          ))}
        </div>
      </div>
      {source === "rss" ? (
        <div>
          {feeds.rss.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>From an RSS widget on your dashboard</div>
              <select value={feeds.rss.some((f) => f.url === config.rssUrl) ? config.rssUrl : ""} onChange={(e) => { if (e.target.value) patch({ rssUrl: e.target.value }); }} style={{ width: "100%", fontSize: 12, padding: "5px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-base)", color: "var(--text-primary)", outline: "none" }}>
                <option value="">— pick a feed —</option>
                {feeds.rss.map((f) => <option key={f.url} value={f.url}>{f.title}</option>)}
              </select>
            </div>
          )}
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>{feeds.rss.length > 0 ? "…or enter a URL" : "Feed URL"}</div>
          <input value={config.rssUrl || ""} onChange={(e) => patch({ rssUrl: e.target.value })} placeholder="https://example.com/feed.xml" style={{ width: "100%", boxSizing: "border-box", fontSize: 12, padding: "5px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-base)", color: "var(--text-primary)", outline: "none" }} />
        </div>
      ) : (
        <div>
          {feeds.reddit.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>From a Reddit widget on your dashboard</div>
              <select value={feeds.reddit.some((f) => f.subreddit === config.subreddit) ? config.subreddit : ""} onChange={(e) => { if (e.target.value) patch({ subreddit: e.target.value }); }} style={{ width: "100%", fontSize: 12, padding: "5px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-base)", color: "var(--text-primary)", outline: "none" }}>
                <option value="">— pick a subreddit —</option>
                {feeds.reddit.map((f) => <option key={f.subreddit} value={f.subreddit}>r/{f.subreddit}</option>)}
              </select>
            </div>
          )}
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>{feeds.reddit.length > 0 ? "…or enter a subreddit" : "Subreddit"}</div>
          <input value={config.subreddit || ""} onChange={(e) => patch({ subreddit: e.target.value.replace(/^r\//, "") })} placeholder="technology" style={{ width: "100%", boxSizing: "border-box", fontSize: 12, padding: "5px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-base)", color: "var(--text-primary)", outline: "none" }} />
        </div>
      )}
    </>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 8 }}>
      {!text && !loading && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, color: "var(--text-muted)" }}>
          <Newspaper size={22} color="var(--accent)" />
          <button onClick={generate} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, padding: "8px 16px", borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer" }}>
            <Newspaper size={13} /> Summarize feed
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
