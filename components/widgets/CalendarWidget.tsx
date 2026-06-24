"use client";
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { useWidgetSettings, useWidgetRefresh } from "@/components/WidgetWrapper";

interface CalEvent {
  id: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  htmlLink?: string;
  colorId?: string;
}

type CalView = "month" | "list" | "both";

const COLORS: Record<string, string> = {
  "1": "#ac725e", "2": "#d06b64", "3": "#f83a22", "4": "#fa573c",
  "5": "#ff7537", "6": "#ffad46", "7": "#42d692", "8": "#16a765",
  "9": "#7bd148", "10": "#b3dc6c", "11": "#fbe983", "default": "#58a6ff",
};

function eventStart(e: CalEvent) {
  return new Date(e.start?.dateTime || e.start?.date || "");
}

function UpcomingList({ events }: { events: CalEvent[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, overflowY: "auto", flex: 1, minHeight: 0 }}>
      {events.length === 0 ? (
        <div style={{ color: "var(--text-muted)", fontSize: 12 }}>No upcoming events</div>
      ) : (
        events.slice(0, 15).map((e) => {
          const start = eventStart(e);
          const color = COLORS[e.colorId || "default"];
          return (
            <a key={e.id} href={e.htmlLink || "#"} target="_blank" rel="noopener noreferrer"
              style={{ display: "flex", gap: 7, padding: "5px 7px", borderRadius: 7, background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", textDecoration: "none", alignItems: "flex-start", flexShrink: 0 }}>
              <div style={{ width: 3, borderRadius: 2, alignSelf: "stretch", background: color, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: "var(--text-primary)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.summary || "(No title)"}</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}>
                  {start.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
                  {e.start?.dateTime && " · " + start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </a>
          );
        })
      )}
    </div>
  );
}

function MonthGrid({ events, monthOffset, setMonthOffset }: {
  events: CalEvent[];
  monthOffset: number;
  setMonthOffset: (o: (prev: number) => number) => void;
}) {
  const today = new Date();
  const displayMonth = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const daysInMonth = new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1, 0).getDate();
  const firstDay = displayMonth.getDay();
  const rawCells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const numWeeks = Math.ceil(rawCells.length / 7);
  // Pad to an exact multiple of 7 so the grid has no empty trailing row
  const cells: (number | null)[] = [
    ...rawCells,
    ...Array(numWeeks * 7 - rawCells.length).fill(null),
  ];

  const eventsInMonth = events.filter((e) => {
    const d = eventStart(e);
    return d.getFullYear() === displayMonth.getFullYear() && d.getMonth() === displayMonth.getMonth();
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 0, minHeight: 0 }}>
      {/* Nav */}
      <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
        <button onClick={() => setMonthOffset((o) => o - 1)} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", padding: "1px 3px" }}><ChevronLeft size={13} /></button>
        <span style={{ fontSize: 11, color: "var(--text-secondary)", flex: 1, textAlign: "center", fontWeight: 600 }}>
          {displayMonth.toLocaleDateString([], { month: "long", year: "numeric" })}
        </span>
        <button onClick={() => setMonthOffset((o) => o + 1)} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", padding: "1px 3px" }}><ChevronRight size={13} /></button>
      </div>

      {/* Grid — rows match actual weeks needed, no empty trailing row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gridTemplateRows: `auto repeat(${numWeeks}, 1fr)`, flex: 1, minHeight: 0, gap: 1 }}>
        {["Su","Mo","Tu","We","Th","Fr","Sa"].map((d) => (
          <div key={d} style={{ textAlign: "center", fontSize: 9, color: "var(--text-muted)", fontWeight: 700, padding: "0 0 2px" }}>{d}</div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={`e${i}`} />;
          const isToday = day === today.getDate() && monthOffset === 0;
          const dayEvents = eventsInMonth.filter((e) => eventStart(e).getDate() === day);
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "1px 0", borderRadius: 4, background: isToday ? "var(--accent)" : "transparent", overflow: "hidden" }}>
              <span style={{ fontSize: 10, color: isToday ? "#fff" : "var(--text-primary)", fontWeight: isToday ? 700 : 400, lineHeight: 1.4 }}>{day}</span>
              {dayEvents.length > 0 && (
                <div style={{ display: "flex", gap: 1, flexWrap: "wrap", justifyContent: "center" }}>
                  {dayEvents.slice(0, 3).map((e) => (
                    <div key={e.id} style={{ width: 3, height: 3, borderRadius: "50%", background: COLORS[e.colorId || "default"] }} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function CalendarWidget({
  loggedIn,
  config,
  onConfigChange,
}: {
  loggedIn: boolean;
  config?: { view?: string };
  onConfigChange?: (c: Record<string, unknown>) => void;
}) {
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [error, setError] = useState("");
  const [view, setView] = useState<CalView>((config?.view as CalView) || "both");
  const [monthOffset, setMonthOffset] = useState(0);

  const load = useCallback(() => {
    if (!loggedIn) return;
    setError("");
    fetch("/api/calendar")
      .then((r) => r.json())
      .then((j) => { if (j.error) setError(j.error); else setEvents(j.events || []); })
      .catch((e) => setError(String(e)));
  }, [loggedIn]);

  useEffect(() => { load(); }, [load]);
  useWidgetRefresh(load);

  const setAndSaveView = (v: CalView) => {
    setView(v);
    onConfigChange?.({ ...config, view: v });
  };

  useWidgetSettings(
    <>
      <div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>View</div>
        <div style={{ display: "flex", gap: 6 }}>
          {(["both", "month", "list"] as CalView[]).map((v) => (
            <button key={v} onClick={() => setAndSaveView(v)} style={{
              fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)", cursor: "pointer",
              background: view === v ? "var(--accent)" : "transparent",
              color: view === v ? "#fff" : "var(--text-secondary)",
            }}>{v === "both" ? "Both" : v === "list" ? "Upcoming" : "Month"}</button>
          ))}
        </div>
      </div>
      <a href="https://calendar.google.com" target="_blank" rel="noopener noreferrer"
        style={{ fontSize: 12, color: "var(--accent)", textDecoration: "none", display: "flex", alignItems: "center", gap: 5 }}>
        <ExternalLink size={12} /> Open Google Calendar
      </a>
    </>
  );

  if (!loggedIn) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 8, color: "var(--text-secondary)", fontSize: 13 }}>
        <span>Sign in with Google to see your calendar</span>
        <a href="/api/auth/signin" style={{ color: "var(--accent)", textDecoration: "none", fontSize: 12 }}>Sign in →</a>
      </div>
    );
  }
  if (error) return <div style={{ color: "var(--danger)", fontSize: 12 }}>{error}</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 6, overflow: "hidden" }}>
      {/* Content — fills remaining height exactly */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden" }}>
        {view === "month" && (
          <MonthGrid events={events} monthOffset={monthOffset} setMonthOffset={setMonthOffset} />
        )}
        {view === "list" && (
          <UpcomingList events={events} />
        )}
        {view === "both" && (
          <div style={{ display: "flex", gap: 10, flex: 1, overflow: "hidden", minHeight: 0 }}>
            <div style={{ flex: "0 0 55%", minWidth: 0, display: "flex", overflow: "hidden" }}>
              <MonthGrid events={events} monthOffset={monthOffset} setMonthOffset={setMonthOffset} />
            </div>
            <div style={{ width: 1, background: "var(--border)", flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0, display: "flex", overflow: "hidden" }}>
              <UpcomingList events={events} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
