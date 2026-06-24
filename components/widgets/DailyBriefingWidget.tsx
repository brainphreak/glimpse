"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { useWidgetSettings, useWidgetRefresh } from "@/components/WidgetWrapper";
import {
  discoverModels, DEFAULT_CLAUDE_MODEL,
  streamChat, type ModelOption,
} from "@/lib/ai";

interface Sources { calendar: boolean; gmail: boolean; rss: boolean }
interface BriefingConfig { model?: string; sources?: Partial<Sources>; rssUrl?: string; lastText?: string; lastAt?: number }

const DEFAULT_SOURCES: Sources = { calendar: true, gmail: true, rss: false };

interface CalEvent { summary?: string; start?: { dateTime?: string; date?: string } }
interface GmailMsg { subject: string; from: string; unread: boolean; snippet: string }
interface RssItem { title: string; contentSnippet?: string }

// Human label for an event start, including the weekday so the model can tell today vs tomorrow.
function whenLabel(e: CalEvent): string {
  const iso = e.start?.dateTime || e.start?.date;
  if (!iso) return "";
  const d = new Date(iso);
  if (e.start?.dateTime) return d.toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" });
  return d.toLocaleDateString([], { weekday: "short" }) + " (all day)";
}

export default function DailyBriefingWidget({ config, onConfigChange }: { config: BriefingConfig; onConfigChange?: (c: Record<string, unknown>) => void }) {
  const sources: Sources = { ...DEFAULT_SOURCES, ...(config.sources || {}) };
  const [models, setModels] = useState<ModelOption[]>([]);
  const [model, setModel] = useState(config.model || DEFAULT_CLAUDE_MODEL);
  const [text, setText] = useState(config.lastText || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [generatedAt, setGeneratedAt] = useState<Date | null>(config.lastAt ? new Date(config.lastAt) : null);
  const ollamaUrl = useRef("");

  // Always carry the persisted result through so changing other settings doesn't wipe the saved summary.
  const patch = (p: BriefingConfig) => onConfigChange?.({ model, sources, rssUrl: config.rssUrl, lastText: config.lastText, lastAt: config.lastAt, ...p });

  useEffect(() => {
    (async () => {
      const { models: all, ollamaUrl: url } = await discoverModels();
      ollamaUrl.current = url;
      setModels(all);
      if (all.length && !all.some((m) => m.id === (config.model || model))) setModel(all[0].id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const gather = useCallback(async (): Promise<string> => {
    const parts: string[] = [];
    if (sources.calendar) {
      try {
        const j = await fetch("/api/calendar", { cache: "no-store" }).then((r) => r.json());
        // Events from now through the next ~48h (covers today's remaining + tomorrow).
        const horizon = Date.now() + 48 * 3600 * 1000;
        const upcoming = (j.events as CalEvent[] || []).filter((e) => {
          const iso = e.start?.dateTime || e.start?.date;
          return iso && new Date(iso).getTime() <= horizon;
        }).slice(0, 12);
        if (upcoming.length) {
          parts.push("UPCOMING CALENDAR (next 2 days):\n" + upcoming.map((e) => `- ${whenLabel(e)}: ${e.summary || "(untitled)"}`).join("\n"));
        } else parts.push("UPCOMING CALENDAR: no events in the next 2 days.");
      } catch { /* skip */ }
    }
    if (sources.gmail) {
      try {
        const j = await fetch("/api/gmail", { cache: "no-store" }).then((r) => r.json());
        const unread = (j.messages as GmailMsg[] || []).filter((m) => m.unread).slice(0, 10);
        if (unread.length) {
          parts.push("UNREAD EMAIL:\n" + unread.map((m) => `- From ${m.from.replace(/<.*>/, "").trim()}: ${m.subject} — ${m.snippet.slice(0, 100)}`).join("\n"));
        } else parts.push("UNREAD EMAIL: inbox is clear.");
      } catch { /* skip */ }
    }
    if (sources.rss && config.rssUrl) {
      try {
        const j = await fetch(`/api/rss?url=${encodeURIComponent(config.rssUrl)}`, { cache: "no-store" }).then((r) => r.json());
        const items = (j.items as RssItem[] || []).slice(0, 8);
        if (items.length) parts.push(`HEADLINES (${j.title || "feed"}):\n` + items.map((i) => `- ${i.title}`).join("\n"));
      } catch { /* skip */ }
    }
    return parts.join("\n\n");
  }, [sources.calendar, sources.gmail, sources.rss, config.rssUrl]);

  const generate = useCallback(async () => {
    if (loading) return;
    setLoading(true); setError(""); setText("");
    try {
      const context = await gather();
      if (!context.trim()) { setError("No data available. Enable sources in settings and sign in for Calendar/Gmail."); setLoading(false); return; }
      const now = new Date();
      const system =
        "You are a concise personal assistant writing a briefing. " +
        "Base every statement ONLY on the data provided below — never invent events, emails, or claim a schedule/inbox is empty or 'wide open' unless the data explicitly shows nothing for that period. " +
        "If calendar events are listed, mention the notable ones with their day and time. " +
        "Write a short, friendly summary (max 6 lines), leading with what matters most. Plain text, no markdown headers. Be specific and brief.";
      let acc = "";
      await streamChat(
        {
          model,
          provider: models.find((m) => m.id === model)?.provider,
          system,
          ollamaUrl: ollamaUrl.current,
          messages: [{ role: "user", content: `It is ${now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}, ${now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.\n\n${context}\n\nWrite my briefing.` }],
        },
        (t) => { acc += t; setText((prev) => prev + t); }
      );
      setGeneratedAt(new Date());
      // Persist the result into the widget config so it survives tab switches / reloads.
      onConfigChange?.({ model, sources, rssUrl: config.rssUrl, lastText: acc, lastAt: Date.now() });
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setLoading(false);
    }
  }, [gather, loading, model, models, sources, config.rssUrl, onConfigChange]);

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
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Sources</div>
        {(["calendar", "gmail", "rss"] as (keyof Sources)[]).map((s) => (
          <label key={s} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, color: "var(--text-secondary)", padding: "3px 0", textTransform: "capitalize" }}>
            {s}
            <input type="checkbox" checked={sources[s]} onChange={(e) => patch({ sources: { ...sources, [s]: e.target.checked } })} />
          </label>
        ))}
      </div>
      {sources.rss && (
        <div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>RSS feed URL</div>
          <input defaultValue={config.rssUrl || ""} onBlur={(e) => patch({ rssUrl: e.target.value })} placeholder="https://example.com/feed.xml" style={{ width: "100%", boxSizing: "border-box", fontSize: 12, padding: "5px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-base)", color: "var(--text-primary)", outline: "none" }} />
        </div>
      )}
    </>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 8 }}>
      {!text && !loading && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, color: "var(--text-muted)" }}>
          <Sparkles size={22} color="var(--accent)" />
          <button onClick={generate} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, padding: "8px 16px", borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer" }}>
            <Sparkles size={13} /> Generate briefing
          </button>
          {error && <div style={{ fontSize: 11, color: "var(--danger)", maxWidth: 280, textAlign: "center" }}>{error}</div>}
        </div>
      )}
      {(text || loading) && (
        <>
          <div style={{ flex: 1, overflow: "auto", fontSize: 13, lineHeight: 1.6, color: "var(--text-primary)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {text}
            {loading && <span style={{ opacity: 0.5 }}>▋</span>}
          </div>
          {error && <div style={{ fontSize: 11, color: "var(--danger)" }}>{error}</div>}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border)", paddingTop: 6 }}>
            <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{generatedAt ? `Updated ${generatedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "Generating…"}</span>
            <button onClick={generate} disabled={loading} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, padding: "3px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--accent)", cursor: loading ? "default" : "pointer", opacity: loading ? 0.5 : 1 }}>
              <Sparkles size={11} /> Regenerate
            </button>
          </div>
        </>
      )}
    </div>
  );
}
