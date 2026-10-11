"use client";
import { useCallback, useEffect, useState } from "react";
import { Table, ExternalLink } from "lucide-react";
import { useWidgetSettings, useWidgetRefresh } from "@/components/WidgetWrapper";

// General-purpose Google Sheet reader. Point it at a sheet + tab, map a few columns,
// and it renders the rows as a list (title / badge / subtitle / time), with an optional filter.
// Instance it once per use-case (Voice log, support tickets, inventory, …).
interface SheetConfig {
  sheetUrl?: string;
  range?: string;
  titleColumn?: string;
  badgeColumn?: string;
  subtitleColumn?: string;
  timeColumn?: string;
  filterColumn?: string;
  filterValues?: string;   // comma-separated; blank = show all
  maxEntries?: number;     // how many rows to display (after sort); blank = 50
  timeFormat?: "date" | "datetime" | "relative";
}

const DEFAULT_RANGE = "A:Z";   // all rows of columns A–Z (don't cap rows, or newest appended rows get missed)
const DEFAULT_MAX = 50;

type TimeFormat = "date" | "datetime" | "relative";

function formatTime(v: string | undefined, fmt: TimeFormat) {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return v.length > 20 ? v.slice(0, 20) : v;  // unparseable → raw
  if (fmt === "relative") {
    const s = Math.floor((Date.now() - d.getTime()) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return `${Math.floor(s / 60)}m`;
    if (s < 86400) return `${Math.floor(s / 3600)}h`;
    return `${Math.floor(s / 86400)}d`;
  }
  if (fmt === "datetime") return d.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  return d.toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" });
}

export default function SheetWidget({ config, onConfigChange }: { config: SheetConfig; onConfigChange?: (c: Record<string, unknown>) => void }) {
  const range = config.range || DEFAULT_RANGE;
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const timeFormat: TimeFormat = config.timeFormat || "datetime";
  const maxEntries = config.maxEntries && config.maxEntries > 0 ? config.maxEntries : DEFAULT_MAX;

  const patch = (p: SheetConfig) => onConfigChange?.({
    sheetUrl: config.sheetUrl, range, titleColumn: config.titleColumn, badgeColumn: config.badgeColumn,
    subtitleColumn: config.subtitleColumn, timeColumn: config.timeColumn, filterColumn: config.filterColumn,
    filterValues: config.filterValues, maxEntries: config.maxEntries, timeFormat: config.timeFormat, ...p,
  });

  const load = useCallback(() => {
    if (!config.sheetUrl) { setLoading(false); return; }   // works for public sheets even without sign-in
    setLoading(true); setError("");
    fetch(`/api/sheets?id=${encodeURIComponent(config.sheetUrl)}&range=${encodeURIComponent(range)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => { if (j.error) setError(j.error); else { setHeaders(j.headers || []); setRows(j.rows || []); } })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [config.sheetUrl, range]);

  useEffect(() => { load(); }, [load]);
  useWidgetRefresh(load);

  // Resolve configured column names against the real headers (case-insensitive).
  const key = (name?: string) => (name && headers.find((h) => h.toLowerCase() === name.toLowerCase())) || "";
  const titleKey = key(config.titleColumn) || headers[0] || "";
  const badgeKey = key(config.badgeColumn);
  const subKey = key(config.subtitleColumn);
  const timeKey = key(config.timeColumn);
  const filterKey = key(config.filterColumn);
  const filterSet = new Set((config.filterValues || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean));

  let items = rows.filter((r) => {
    if (!filterKey || filterSet.size === 0) return true;
    return filterSet.has((r[filterKey] || "").trim().toLowerCase());
  });
  if (timeKey) items = [...items].sort((a, b) => new Date(b[timeKey] || 0).getTime() - new Date(a[timeKey] || 0).getTime());
  const total = items.length;
  const shown = items.slice(0, maxEntries);   // newest N after sorting

  const field = (label: string, k: keyof SheetConfig, placeholder: string) => (
    <div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>{label}</div>
      <input defaultValue={(config[k] as string) || ""} onBlur={(e) => patch({ [k]: e.target.value } as SheetConfig)} placeholder={placeholder}
        style={{ width: "100%", boxSizing: "border-box", fontSize: 12, padding: "5px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-base)", color: "var(--text-primary)", outline: "none" }} />
    </div>
  );

  useWidgetSettings(
    <>
      <div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Google Sheet URL</div>
        <input defaultValue={config.sheetUrl || ""} onBlur={(e) => patch({ sheetUrl: e.target.value })} placeholder="https://docs.google.com/spreadsheets/d/…"
          style={{ width: "100%", boxSizing: "border-box", fontSize: 12, padding: "5px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-base)", color: "var(--text-primary)", outline: "none" }} />
      </div>
      {field("Range / tab (e.g. Tickets!A1:Z500)", "range", DEFAULT_RANGE)}
      {headers.length > 0 && <div style={{ fontSize: 10, color: "var(--text-muted)", lineHeight: 1.4 }}>Columns found: {headers.filter(Boolean).join(", ")}</div>}
      {field("Title column (blank = first)", "titleColumn", "e.g. Customer Name")}
      {field("Badge column (optional)", "badgeColumn", "e.g. Urgency / type")}
      {field("Subtitle column (optional)", "subtitleColumn", "e.g. Summary / message_content")}
      {field("Time column (optional, sorts newest first)", "timeColumn", "e.g. Timestamp / received_at")}
      {field("Filter column (optional)", "filterColumn", "e.g. Status")}
      {field("Filter values — show only these (comma; blank = all)", "filterValues", "open, new, in progress")}
      <div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Max entries to show</div>
        <input type="number" min={1} defaultValue={config.maxEntries || DEFAULT_MAX} onBlur={(e) => patch({ maxEntries: Math.max(1, parseInt(e.target.value) || DEFAULT_MAX) })}
          style={{ width: "100%", boxSizing: "border-box", fontSize: 12, padding: "5px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-base)", color: "var(--text-primary)", outline: "none" }} />
      </div>
      <div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Time display</div>
        <div style={{ display: "flex", gap: 6 }}>
          {([["date", "Date"], ["datetime", "Date+time"], ["relative", "Relative"]] as [TimeFormat, string][]).map(([v, label]) => (
            <button key={v} onClick={() => patch({ timeFormat: v })} style={{ flex: 1, fontSize: 11, padding: "4px 0", borderRadius: 6, border: "1px solid var(--border)", cursor: "pointer", background: timeFormat === v ? "var(--accent)" : "transparent", color: timeFormat === v ? "#fff" : "var(--text-secondary)" }}>{label}</button>
          ))}
        </div>
      </div>
    </>
  );

  if (!config.sheetUrl) return <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 8, color: "var(--text-muted)", textAlign: "center" }}><Table size={22} color="var(--accent)" /><div style={{ fontSize: 12 }}>Open the gear and paste a Google Sheet URL (public, or sign in for a private one).</div></div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Table size={13} color="var(--accent)" />
        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{loading ? "Loading…" : (total > shown.length ? `${shown.length} of ${total}` : `${total} row${total !== 1 ? "s" : ""}`)}</span>
        <a href={config.sheetUrl} target="_blank" rel="noopener noreferrer" title="Open sheet" style={{ marginLeft: "auto", display: "flex", color: "var(--text-muted)" }}><ExternalLink size={12} /></a>
      </div>

      {error && <div style={{ fontSize: 11, color: "var(--danger)", lineHeight: 1.5 }}>{error}</div>}

      <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: 5 }}>
        {!loading && !error && shown.length === 0 && <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", paddingTop: 14 }}>No rows.</div>}
        {shown.map((r, i) => (
          <div key={i} style={{ padding: "7px 9px", borderRadius: 8, border: "1px solid var(--border)", background: "rgba(255,255,255,0.02)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.3, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{r[titleKey] || "(untitled)"}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                {badgeKey && r[badgeKey] && <span style={{ fontSize: 9.5, fontWeight: 600, padding: "2px 7px", borderRadius: 10, background: "rgba(88,166,255,0.15)", color: "var(--accent)", whiteSpace: "nowrap" }}>{r[badgeKey]}</span>}
                {timeKey && r[timeKey] && <span style={{ fontSize: 10, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{formatTime(r[timeKey], timeFormat)}</span>}
              </div>
            </div>
            {subKey && r[subKey] && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{r[subKey]}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
