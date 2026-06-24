"use client";
import { useCallback, useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { useWidgetSettings, useWidgetRefresh } from "@/components/WidgetWrapper";

interface RSSItem {
  title: string;
  link: string;
  pubDate: string;
  contentSnippet: string;
}

type TitleAlign = "left" | "center" | "right";

export default function RSSWidget({ config, onConfigChange }: { config: { url?: string; title?: string; titleAlign?: TitleAlign }; onConfigChange?: (c: Record<string, string>) => void }) {
  const [items, setItems] = useState<RSSItem[]>([]);
  const [feedTitle, setFeedTitle] = useState(config.title || "RSS Feed");
  const [error, setError] = useState("");
  const [urlDraft, setUrlDraft] = useState(config.url || "");
  const titleAlign: TitleAlign = config.titleAlign || "left";

  const saveConfig = (patch: Record<string, string>) =>
    onConfigChange?.({ url: config.url || "", title: feedTitle, titleAlign, ...patch });

  const load = useCallback((url?: string) => {
    const u = url ?? config.url;
    if (!u) return;
    setError("");
    fetch(`/api/rss?url=${encodeURIComponent(u)}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.error) { setError(j.error); return; }
        setItems(j.items || []);
        if (j.title) setFeedTitle(j.title);
      })
      .catch((e) => setError(String(e)));
  }, [config.url]);

  useEffect(() => { if (config.url) load(config.url); }, [config.url, load]);
  useWidgetRefresh(() => load());

  useWidgetSettings(
    <>
      <div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Feed URL</div>
        <div style={{ display: "flex", gap: 6 }}>
          <input
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { saveConfig({ url: urlDraft }); load(urlDraft); } }}
            placeholder="https://example.com/feed.xml"
            style={{ flex: 1, minWidth: 0, background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 6, padding: "5px 8px", color: "var(--text-primary)", fontSize: 12, outline: "none" }}
          />
          <button onClick={() => { saveConfig({ url: urlDraft }); load(urlDraft); }} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer" }}>Save</button>
        </div>
      </div>
      <div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Feed name alignment</div>
        <div style={{ display: "flex", gap: 6 }}>
          {(["left", "center", "right"] as TitleAlign[]).map((a) => (
            <button key={a} onClick={() => saveConfig({ titleAlign: a })} style={{
              fontSize: 11, padding: "4px 12px", borderRadius: 6, border: "1px solid var(--border)", cursor: "pointer", textTransform: "capitalize",
              background: titleAlign === a ? "var(--accent)" : "transparent", color: titleAlign === a ? "#fff" : "var(--text-secondary)",
            }}>{a}</button>
          ))}
        </div>
      </div>
    </>
  );

  if (!config.url) {
    return <div style={{ color: "var(--text-muted)", fontSize: 12, textAlign: "center", paddingTop: 20 }}>Open the gear (settings) and add a feed URL.</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 8 }}>
      <div style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: titleAlign }}>{feedTitle}</div>
      {error && <div style={{ color: "var(--danger)", fontSize: 11 }}>{error}</div>}
      <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
        {items.map((item, i) => (
          <a key={i} href={item.link} target="_blank" rel="noopener noreferrer" style={{ display: "block", padding: "6px 8px", borderRadius: 8, border: "1px solid var(--border)", background: "rgba(255,255,255,0.02)", textDecoration: "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
              <span style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 500, lineHeight: 1.3 }}>{item.title}</span>
              <ExternalLink size={10} color="var(--text-muted)" style={{ flexShrink: 0, marginTop: 2 }} />
            </div>
            {item.contentSnippet && <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.contentSnippet}</div>}
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 3 }}>{item.pubDate ? new Date(item.pubDate).toLocaleDateString([], { month: "short", day: "numeric" }) : ""}</div>
          </a>
        ))}
      </div>
    </div>
  );
}
