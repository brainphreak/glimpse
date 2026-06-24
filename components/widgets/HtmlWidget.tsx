"use client";
import { useState } from "react";
import { useWidgetSettings } from "@/components/WidgetWrapper";

export default function HtmlWidget({
  config = {},
  onConfigChange,
}: {
  config?: { html?: string };
  onConfigChange?: (c: Record<string, unknown>) => void;
}) {
  const [draft, setDraft] = useState(config.html ?? "");

  useWidgetSettings(
    <div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>HTML</div>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="<h1>Hello!</h1>"
        spellCheck={false}
        rows={6}
        style={{ width: "100%", background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 8, padding: 8, color: "var(--text-primary)", fontSize: 12, fontFamily: "monospace", resize: "vertical", outline: "none", boxSizing: "border-box" }}
      />
      <button onClick={() => onConfigChange?.({ ...config, html: draft })} style={{ marginTop: 6, fontSize: 11, padding: "4px 12px", borderRadius: 6, border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer" }}>Save</button>
    </div>
  );

  return (
    <div
      style={{ height: "100%", overflow: "auto", color: "var(--text-primary)", fontSize: 13 }}
      dangerouslySetInnerHTML={{ __html: config.html || "<em style='color:var(--text-muted)'>Open the gear (settings) to add HTML</em>" }}
    />
  );
}
