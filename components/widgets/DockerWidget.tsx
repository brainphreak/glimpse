"use client";
import { useCallback, useEffect, useState } from "react";
import { Box } from "lucide-react";
import { useWidgetRefresh } from "@/components/WidgetWrapper";

interface Container { name: string; image: string; state: string; status: string }

const stateColor = (s: string) =>
  s === "running" ? "var(--success)" : s === "paused" ? "var(--warning)" : "var(--danger)";

export default function DockerWidget() {
  const [containers, setContainers] = useState<Container[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/docker").then((r) => r.json()).then((j) => { if (j.error) { setError(j.error); setContainers([]); } else { setContainers(j.containers || []); setError(""); } }).catch((e) => setError(String(e))).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, [load]);
  useWidgetRefresh(load);

  if (error) return <div style={{ fontSize: 11, color: "var(--text-muted)", padding: 8, lineHeight: 1.5 }}>{error}</div>;

  const running = containers.filter((c) => c.state === "running").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-secondary)" }}>
        <Box size={13} /> {loading && !containers.length ? "Loading…" : `${running}/${containers.length} running`}
      </div>
      <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
        {containers.map((c) => (
          <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: stateColor(c.state), flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.image}</div>
            </div>
            <span style={{ fontSize: 10, color: "var(--text-muted)", flexShrink: 0 }}>{c.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
