"use client";
import { useCallback, useEffect, useState } from "react";
import { ArrowUp, MessageSquare, ExternalLink } from "lucide-react";
import { useWidgetSettings, useWidgetRefresh } from "@/components/WidgetWrapper";

interface RedditPost {
  id: string;
  title: string;
  subreddit: string;
  author: string;
  score: number;
  numComments: number;
  url: string;
  permalink: string;
  selftext: string;
  created: number;
}

const SORTS = ["hot", "new", "top", "rising"] as const;

export default function RedditWidget({ config, onConfigChange }: { config: { subreddit?: string; sort?: string }; onConfigChange?: (c: Record<string, string>) => void }) {
  const [posts, setPosts] = useState<RedditPost[]>([]);
  const [error, setError] = useState("");
  const [subDraft, setSubDraft] = useState(config.subreddit || "");
  const sort = config.sort || "hot";

  const load = useCallback((sub?: string, s?: string) => {
    const sr = sub ?? config.subreddit;
    const so = s ?? sort;
    if (!sr) return;
    setError("");
    fetch(`/api/reddit?subreddit=${encodeURIComponent(sr)}&sort=${so}`)
      .then((r) => r.json())
      .then((j) => { if (j.error) setError(j.error); else setPosts(j.posts || []); })
      .catch((e) => setError(String(e)));
  }, [config.subreddit, sort]);

  useEffect(() => { if (config.subreddit) load(config.subreddit, sort); }, [config.subreddit, sort, load]);
  useWidgetRefresh(() => load());

  const saveSub = () => { onConfigChange?.({ subreddit: subDraft.replace(/^r\//, ""), sort }); };

  useWidgetSettings(
    <>
      <div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Subreddit</div>
        <div style={{ display: "flex", gap: 6 }}>
          <input
            value={subDraft}
            onChange={(e) => setSubDraft(e.target.value.replace(/^r\//, ""))}
            onKeyDown={(e) => { if (e.key === "Enter") saveSub(); }}
            placeholder="homelab"
            style={{ flex: 1, minWidth: 0, background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 6, padding: "5px 8px", color: "var(--text-primary)", fontSize: 12, outline: "none" }}
          />
          <button onClick={saveSub} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer" }}>Save</button>
        </div>
      </div>
      <div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Sort</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {SORTS.map((s) => (
            <button key={s} onClick={() => onConfigChange?.({ subreddit: config.subreddit || "", sort: s })} style={{
              fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)", cursor: "pointer", textTransform: "capitalize",
              background: sort === s ? "var(--accent)" : "transparent", color: sort === s ? "#fff" : "var(--text-secondary)",
            }}>{s}</button>
          ))}
        </div>
      </div>
    </>
  );

  if (!config.subreddit) {
    return <div style={{ color: "var(--text-muted)", fontSize: 12, textAlign: "center", paddingTop: 20 }}>Open the gear (settings) and pick a subreddit.</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 8 }}>
      <span style={{ fontSize: 12, color: "var(--purple)", fontWeight: 600 }}>r/{config.subreddit} · {sort}</span>
      {error && <div style={{ color: "var(--danger)", fontSize: 11 }}>{error}</div>}
      <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
        {posts.map((post) => (
          <div key={post.id} style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "rgba(255,255,255,0.02)" }}>
            <a href={post.permalink} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "var(--text-primary)", textDecoration: "none", fontWeight: 500, lineHeight: 1.3, display: "block", marginBottom: 5 }}>{post.title}</a>
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 10, color: "var(--text-muted)" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 3 }}><ArrowUp size={10} />{post.score.toLocaleString()}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 3 }}><MessageSquare size={10} />{post.numComments}</span>
              <span>u/{post.author}</span>
              <div style={{ flex: 1 }} />
              <a href={post.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--text-muted)" }}><ExternalLink size={10} /></a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
