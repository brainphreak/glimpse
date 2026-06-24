"use client";
import { useState } from "react";
import { useWidgetSettings } from "@/components/WidgetWrapper";

type Fit = "contain" | "cover" | "fill";

export default function ImageWidget({
  config = {},
  onConfigChange,
}: {
  config?: { url?: string; fit?: Fit; alt?: string };
  onConfigChange?: (c: Record<string, unknown>) => void;
}) {
  const [draft, setDraft] = useState({ url: config.url ?? "", fit: config.fit ?? "contain", alt: config.alt ?? "" });

  useWidgetSettings(
    <>
      <div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Image URL</div>
        <input value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} placeholder="https://example.com/image.gif"
          style={{ width: "100%", background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 6, padding: "5px 8px", color: "var(--text-primary)", fontSize: 12, outline: "none", boxSizing: "border-box" }} />
      </div>
      <div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Alt text (optional)</div>
        <input value={draft.alt} onChange={(e) => setDraft({ ...draft, alt: e.target.value })} placeholder="Description"
          style={{ width: "100%", background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 6, padding: "5px 8px", color: "var(--text-primary)", fontSize: 12, outline: "none", boxSizing: "border-box" }} />
      </div>
      <div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Fit</div>
        <div style={{ display: "flex", gap: 6 }}>
          {(["contain", "cover", "fill"] as Fit[]).map((f) => (
            <button key={f} onClick={() => setDraft({ ...draft, fit: f })} style={{
              fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)", cursor: "pointer", textTransform: "capitalize",
              background: draft.fit === f ? "var(--accent)" : "transparent", color: draft.fit === f ? "#fff" : "var(--text-secondary)",
            }}>{f}</button>
          ))}
        </div>
      </div>
      <button onClick={() => onConfigChange?.({ ...config, ...draft })} style={{ fontSize: 11, padding: "4px 12px", borderRadius: 6, border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer", alignSelf: "flex-start" }}>Save</button>
    </>
  );

  if (!config.url) {
    return <div style={{ color: "var(--text-muted)", fontSize: 12, textAlign: "center", paddingTop: 20 }}>Open the gear (settings) to set an image URL.</div>;
  }

  return (
    <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <img src={config.url} alt={config.alt ?? ""} style={{ width: "100%", height: "100%", objectFit: config.fit ?? "contain", borderRadius: 4 }} />
    </div>
  );
}
