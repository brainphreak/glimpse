"use client";
import { useEffect, useState } from "react";
import { useWidgetSettings } from "@/components/WidgetWrapper";

interface ClockConfig {
  showSeconds?: boolean;
  showDate?: boolean;
  timezone?: string;
  label?: string;
  color?: string;
  fontSize?: number;
}

const COMMON_TIMEZONES = [
  { label: "Local",          value: "" },
  { label: "UTC",            value: "UTC" },
  { label: "New York",       value: "America/New_York" },
  { label: "Chicago",        value: "America/Chicago" },
  { label: "Denver",         value: "America/Denver" },
  { label: "Los Angeles",    value: "America/Los_Angeles" },
  { label: "London",         value: "Europe/London" },
  { label: "Paris",          value: "Europe/Paris" },
  { label: "Berlin",         value: "Europe/Berlin" },
  { label: "Moscow",         value: "Europe/Moscow" },
  { label: "Dubai",          value: "Asia/Dubai" },
  { label: "Mumbai",         value: "Asia/Kolkata" },
  { label: "Singapore",      value: "Asia/Singapore" },
  { label: "Tokyo",          value: "Asia/Tokyo" },
  { label: "Sydney",         value: "Australia/Sydney" },
];

export default function ClockWidget({
  config,
  onConfigChange,
}: {
  config?: ClockConfig;
  onConfigChange?: (c: Record<string, unknown>) => void;
}) {
  const showSeconds = config?.showSeconds ?? true;
  const showDate = config?.showDate ?? true;
  const timezone = config?.timezone ?? "";
  const label = config?.label ?? "";
  const color = config?.color ?? "var(--accent)";
  const fontSize = config?.fontSize ?? 36;

  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const set = (patch: Partial<ClockConfig>) => onConfigChange?.({ ...config, ...patch });

  const tzOptions: Intl.DateTimeFormatOptions = timezone ? { timeZone: timezone } : {};
  const timeStr = now.toLocaleTimeString([], {
    hour: "2-digit", minute: "2-digit",
    ...(showSeconds ? { second: "2-digit" } : {}),
    ...tzOptions,
  });
  const dateStr = now.toLocaleDateString([], {
    weekday: "long", month: "long", day: "numeric", year: "numeric", ...tzOptions,
  });

  useWidgetSettings(
    <>
      <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, color: "var(--text-secondary)" }}>
        Show seconds
        <input type="checkbox" checked={showSeconds} onChange={(e) => set({ showSeconds: e.target.checked })} />
      </label>
      <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, color: "var(--text-secondary)" }}>
        Show date
        <input type="checkbox" checked={showDate} onChange={(e) => set({ showDate: e.target.checked })} />
      </label>
      <div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Timezone</div>
        <select value={timezone} onChange={(e) => set({ timezone: e.target.value })}
          style={{ width: "100%", background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 8px", color: "var(--text-primary)", fontSize: 12, outline: "none" }}>
          {COMMON_TIMEZONES.map((tz) => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
        </select>
      </div>
      <div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Label (optional)</div>
        <input value={label} onChange={(e) => set({ label: e.target.value })} placeholder='e.g. "Europe"'
          style={{ width: "100%", background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 8px", color: "var(--text-primary)", fontSize: 12, outline: "none", boxSizing: "border-box" }} />
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Time color</span>
        <input type="color" value={color.startsWith("#") ? color : "#58a6ff"} onChange={(e) => set({ color: e.target.value })}
          style={{ width: 36, height: 26, padding: 1, border: "1px solid var(--border)", borderRadius: 4, cursor: "pointer", background: "transparent" }} />
      </div>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Font size</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{fontSize}px</span>
        </div>
        <input type="range" min={16} max={96} step={2} value={fontSize} onChange={(e) => set({ fontSize: Number(e.target.value) })}
          style={{ width: "100%", accentColor: "var(--accent)" }} />
      </div>
    </>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 4, userSelect: "none" }}>
      {label && (
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)" }}>{label}</div>
      )}
      <div style={{ fontSize: fontSize, fontWeight: 700, fontVariantNumeric: "tabular-nums", color, letterSpacing: "-0.02em" }}>
        {timeStr}
      </div>
      {showDate && (
        <div style={{ fontSize: "clamp(0.7rem, 1.5vw, 0.9rem)", color: "var(--text-secondary)" }}>{dateStr}</div>
      )}
    </div>
  );
}
