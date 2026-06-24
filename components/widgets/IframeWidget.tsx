"use client";
import { useState } from "react";
import { useWidgetSettings } from "@/components/WidgetWrapper";

export default function IframeWidget({
  config = {},
  onConfigChange,
}: {
  config?: { url?: string; scrolling?: boolean };
  onConfigChange?: (c: Record<string, unknown>) => void;
}) {
  const [draft, setDraft] = useState({ url: config.url ?? "", scrolling: config.scrolling ?? true });

  const save = () => {
    let url = draft.url.trim();
    if (url && !/^https?:\/\//i.test(url)) url = "https://" + url;
    onConfigChange?.({ ...config, url, scrolling: draft.scrolling });
  };

  useWidgetSettings(
    <>
      <div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>URL to embed</div>
        <input value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} placeholder="https://example.com"
          style={{ width: "100%", background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 6, padding: "5px 8px", color: "var(--text-primary)", fontSize: 12, outline: "none", boxSizing: "border-box" }} />
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-secondary)", cursor: "pointer" }}>
        <input type="checkbox" checked={draft.scrolling} onChange={(e) => setDraft({ ...draft, scrolling: e.target.checked })} />
        Allow scrolling
      </label>
      <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>
        Some sites block embedding via X-Frame-Options. If the frame is blank, the site doesn&apos;t allow iframes.
      </p>
      <button onClick={save} style={{ fontSize: 11, padding: "4px 12px", borderRadius: 6, border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer", alignSelf: "flex-start" }}>Save</button>
    </>
  );

  if (!config.url) {
    return <div style={{ color: "var(--text-muted)", fontSize: 12, textAlign: "center", paddingTop: 20 }}>Open the gear (settings) to set a URL to embed.</div>;
  }

  return (
    <iframe
      src={config.url}
      scrolling={config.scrolling === false ? "no" : "yes"}
      style={{ width: "100%", height: "100%", border: "none", borderRadius: 4, display: "block" }}
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      title="Embedded content"
    />
  );
}
