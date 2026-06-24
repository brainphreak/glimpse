"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useWidgetSettings } from "@/components/WidgetWrapper";

interface WCConfig { zones?: string[]; use24h?: boolean }
const DEFAULT_ZONES = ["America/Los_Angeles", "America/New_York", "Europe/London", "Asia/Tokyo"];

function labelFor(tz: string) {
  return tz.split("/").pop()?.replace(/_/g, " ") || tz;
}

export default function WorldClocksWidget({ config, onConfigChange }: { config: WCConfig; onConfigChange?: (c: Record<string, unknown>) => void }) {
  const zones = config.zones?.length ? config.zones : DEFAULT_ZONES;
  const use24h = !!config.use24h;
  const [now, setNow] = useState(() => new Date());
  const [draft, setDraft] = useState("");

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const patch = (p: WCConfig) => onConfigChange?.({ zones, use24h, ...p });

  useWidgetSettings(
    <>
      <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, color: "var(--text-secondary)" }}>
        24-hour time
        <input type="checkbox" checked={use24h} onChange={(e) => patch({ use24h: e.target.checked })} />
      </label>
      <div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Time zones (IANA)</div>
        {zones.map((z) => (
          <div key={z} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, color: "var(--text-secondary)", padding: "2px 0" }}>
            {z}
            <button onClick={() => patch({ zones: zones.filter((x) => x !== z) })} style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", padding: 0, display: "flex" }}><X size={12} /></button>
          </div>
        ))}
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Europe/Paris" style={{ flex: 1, minWidth: 0, fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-base)", color: "var(--text-primary)", outline: "none" }} />
          <button onClick={() => { const z = draft.trim(); if (z && !zones.includes(z)) { patch({ zones: [...zones, z] }); setDraft(""); } }} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer" }}>Add</button>
        </div>
      </div>
    </>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "center", gap: 4, overflow: "auto" }}>
      {zones.map((tz) => {
        let time = "—", day = "";
        try {
          time = new Intl.DateTimeFormat([], { timeZone: tz, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: !use24h }).format(now);
          day = new Intl.DateTimeFormat([], { timeZone: tz, weekday: "short", month: "short", day: "numeric" }).format(now);
        } catch { time = "invalid zone"; }
        return (
          <div key={tz} style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "6px 8px", borderRadius: 8, background: "rgba(255,255,255,0.02)" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{labelFor(tz)}</div>
              <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{day}</div>
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, color: "var(--accent)", fontVariantNumeric: "tabular-nums" }}>{time}</div>
          </div>
        );
      })}
    </div>
  );
}
