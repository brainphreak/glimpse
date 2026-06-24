"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Responsive, WidthProvider } from "react-grid-layout/legacy";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

const ResponsiveGrid = WidthProvider(Responsive);

import WidgetWrapper, { WidgetMeta } from "./WidgetWrapper";
import AddWidgetModal from "./AddWidgetModal";
import SettingsModal, { DashboardSettings, DEFAULT_SETTINGS, loadSettings, saveSettings, applyTheme } from "./SettingsModal";
import ClockWidget from "./widgets/ClockWidget";
import WeatherWidget from "./widgets/WeatherWidget";
import CalendarWidget from "./widgets/CalendarWidget";
import GmailWidget from "./widgets/GmailWidget";
import NotesWidget from "./widgets/NotesWidget";
import LinksWidget from "./widgets/LinksWidget";
import RSSWidget from "./widgets/RSSWidget";
import RedditWidget from "./widgets/RedditWidget";
import ServerMonitorWidget from "./widgets/ServerMonitorWidget";
import ClaudeWidget from "./widgets/ClaudeWidget";
import DailyBriefingWidget from "./widgets/DailyBriefingWidget";
import FeedDigestWidget from "./widgets/FeedDigestWidget";
import AITerminalWidget from "./widgets/AITerminalWidget";
import WorldClocksWidget from "./widgets/WorldClocksWidget";
import CryptoWidget from "./widgets/CryptoWidget";
import StockTickerWidget from "./widgets/StockTickerWidget";
import NewsWidget from "./widgets/NewsWidget";
import GitHubWidget from "./widgets/GitHubWidget";
import DockerWidget from "./widgets/DockerWidget";
import SysHealthWidget from "./widgets/SysHealthWidget";
import ReadLaterWidget from "./widgets/ReadLaterWidget";
import TerminalWidget from "./widgets/TerminalWidget";
import HtmlWidget from "./widgets/HtmlWidget";
import ImageWidget from "./widgets/ImageWidget";
import IframeWidget from "./widgets/IframeWidget";
import { Plus, LogIn, LogOut, User, Settings, X } from "lucide-react";

interface WidgetDef {
  id: string;
  type: string;
  config: Record<string, unknown>;
  meta?: WidgetMeta;
}

interface PageInfo {
  id: string;
  name: string;
  sort_order: number;
}

interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

const DEFAULT_SIZES: Record<string, { w: number; h: number; minW: number; minH: number }> = {
  clock:            { w: 3, h: 3,  minW: 1, minH: 1 },
  weather:          { w: 3, h: 4,  minW: 1, minH: 1 },
  calendar:         { w: 5, h: 8,  minW: 1, minH: 1 },
  gmail:            { w: 4, h: 7,  minW: 1, minH: 1 },
  notes:            { w: 6, h: 6,  minW: 1, minH: 1 },
  links:            { w: 5, h: 5,  minW: 1, minH: 1 },
  rss:              { w: 4, h: 7,  minW: 1, minH: 1 },
  reddit:           { w: 4, h: 8,  minW: 1, minH: 1 },
  "server-monitor": { w: 6, h: 5,  minW: 1, minH: 1 },
  claude:           { w: 6, h: 8,  minW: 1, minH: 1 },
  "daily-briefing": { w: 5, h: 6,  minW: 1, minH: 1 },
  "feed-digest":    { w: 5, h: 6,  minW: 1, minH: 1 },
  "ai-terminal":    { w: 6, h: 8,  minW: 1, minH: 1 },
  "world-clocks":   { w: 3, h: 5,  minW: 1, minH: 1 },
  crypto:           { w: 3, h: 4,  minW: 1, minH: 1 },
  stocks:           { w: 3, h: 5,  minW: 1, minH: 1 },
  news:             { w: 4, h: 8,  minW: 1, minH: 1 },
  github:           { w: 4, h: 7,  minW: 1, minH: 1 },
  docker:           { w: 4, h: 6,  minW: 1, minH: 1 },
  "sys-health":     { w: 4, h: 4,  minW: 1, minH: 1 },
  "read-later":     { w: 4, h: 6,  minW: 1, minH: 1 },
  terminal:         { w: 8, h: 10, minW: 1, minH: 1 },
  html:             { w: 4, h: 5,  minW: 1, minH: 1 },
  image:            { w: 4, h: 5,  minW: 1, minH: 1 },
  iframe:           { w: 6, h: 8,  minW: 1, minH: 1 },
};

// For mobile breakpoints: sort by column (x) first so left→middle→right column order is preserved
function buildMobileLayout(lgItems: LayoutItem[], cols: number): LayoutItem[] {
  const sorted = [...lgItems].sort((a, b) => a.x - b.x || a.y - b.y);
  let y = 0;
  return sorted.map((item) => {
    const row = { ...item, x: 0, w: cols, minW: 1, minH: 1, y };
    y += item.h;
    return row;
  });
}

function renderWidget(
  widget: WidgetDef,
  loggedIn: boolean,
  onConfigChange: (id: string, config: Record<string, unknown>) => void
) {
  const update = (c: Record<string, unknown>) => onConfigChange(widget.id, c);
  switch (widget.type) {
    case "clock":          return <ClockWidget config={widget.config as { showSeconds?: boolean; showDate?: boolean; timezone?: string; label?: string }} onConfigChange={update} />;
    case "weather":        return <WeatherWidget config={widget.config as { city?: string; unit?: "C" | "F" }} onConfigChange={update} />;
    case "calendar":       return <CalendarWidget loggedIn={loggedIn} config={widget.config as { view?: string }} onConfigChange={update} />;
    case "gmail":          return <GmailWidget loggedIn={loggedIn} />;
    case "notes":          return <NotesWidget />;
    case "links":          return <LinksWidget config={widget.config as { align?: "flex-start" | "center" | "flex-end" }} onConfigChange={update} />;
    case "rss":            return <RSSWidget config={widget.config as { url?: string; title?: string }} onConfigChange={update} />;
    case "reddit":         return <RedditWidget config={widget.config as { subreddit?: string; sort?: string }} onConfigChange={update} />;
    case "server-monitor": return <ServerMonitorWidget config={widget.config as { intervalSeconds?: number }} onConfigChange={update} />;
    case "claude":         return <ClaudeWidget config={widget.config as { model?: string; webSearch?: boolean }} onConfigChange={update} />;
    case "daily-briefing": return <DailyBriefingWidget config={widget.config as { model?: string; sources?: Record<string, boolean>; rssUrl?: string }} onConfigChange={update} />;
    case "feed-digest":    return <FeedDigestWidget config={widget.config as { model?: string; source?: "rss" | "reddit"; rssUrl?: string; subreddit?: string }} onConfigChange={update} />;
    case "ai-terminal":    return <AITerminalWidget config={widget.config as { model?: string }} onConfigChange={update} />;
    case "world-clocks":   return <WorldClocksWidget config={widget.config as { zones?: string[]; use24h?: boolean }} onConfigChange={update} />;
    case "crypto":         return <CryptoWidget config={widget.config as { coins?: string[]; currency?: string }} onConfigChange={update} />;
    case "stocks":         return <StockTickerWidget config={widget.config as { symbols?: string[] }} onConfigChange={update} />;
    case "news":           return <NewsWidget config={widget.config as { feeds?: string[]; showImages?: boolean; layout?: "cards" | "compact" }} onConfigChange={update} />;
    case "github":         return <GitHubWidget />;
    case "docker":         return <DockerWidget />;
    case "sys-health":     return <SysHealthWidget />;
    case "read-later":     return <ReadLaterWidget />;
    case "terminal":       return <TerminalWidget config={widget.config as { cmd?: string; fullscreen?: boolean }} onConfigChange={update} />;
    case "html":           return <HtmlWidget config={widget.config as { html?: string }} onConfigChange={update} />;
    case "image":          return <ImageWidget config={widget.config as { url?: string; fit?: "contain" | "cover" | "fill"; alt?: string }} onConfigChange={update} />;
    case "iframe":         return <IframeWidget config={widget.config as { url?: string; scrolling?: boolean }} onConfigChange={update} />;
    default:               return <div style={{ color: "var(--text-muted)", fontSize: 12 }}>Unknown widget: {widget.type}</div>;
  }
}

interface Props {
  initialPages: PageInfo[];
  initialPageId: string;
  initialWidgets: WidgetDef[];
  initialLayout: LayoutItem[];
  initialSettings?: DashboardSettings | null;
  loggedIn: boolean;
  userEmail?: string | null;
}

export default function Dashboard({ initialPages, initialPageId, initialWidgets, initialLayout, initialSettings, loggedIn, userEmail }: Props) {
  const [pages, setPages] = useState<PageInfo[]>(initialPages);
  const [activePageId, setActivePageId] = useState<string>(initialPageId);
  const [renamingTab, setRenamingTab] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [widgets, setWidgets] = useState<WidgetDef[]>(initialWidgets);
  // Override any stale minW/minH from the DB — user controls sizing freely
  const [layouts, setLayouts] = useState<{ lg: LayoutItem[] }>({
    lg: initialLayout.map((item) => ({ ...item, minW: 1, minH: 1 })),
  });

  // Derive mobile layouts from lg, sorted left-column first so phone view matches desktop column order
  const allLayouts = useMemo(() => ({
    lg: layouts.lg,
    md: layouts.lg,
    sm: buildMobileLayout(layouts.lg, 4),
    xs: buildMobileLayout(layouts.lg, 2),
  }), [layouts.lg]);
  const [showAdd, setShowAdd] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<DashboardSettings>(initialSettings ? { ...DEFAULT_SETTINGS, ...initialSettings } : DEFAULT_SETTINGS);
  const settingsSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Prefer server-stored settings (shared across browsers); fall back to localStorage
  // and seed the server with it so all browsers converge.
  useEffect(() => {
    if (initialSettings) {
      const s = { ...DEFAULT_SETTINGS, ...initialSettings };
      setSettings(s);
      applyTheme(s);
      saveSettings(s);
    } else {
      const s = loadSettings();
      setSettings(s);
      applyTheme(s);
      fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(s) }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = useCallback(async (w: WidgetDef[], l: LayoutItem[]) => {
    setSaving(true);
    await fetch("/api/layout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: activePageId, widgets: w, layout: l }),
    }).finally(() => setSaving(false));
  }, [activePageId]);

  const switchPage = async (id: string) => {
    if (id === activePageId) return;
    setActivePageId(id);
    try {
      const res = await fetch(`/api/layout?id=${encodeURIComponent(id)}`);
      const data = await res.json();
      setWidgets(data.widgets || []);
      setLayouts({ lg: (data.layout || []).map((item: LayoutItem) => ({ ...item, minW: 1, minH: 1 })) });
    } catch {
      setWidgets([]);
      setLayouts({ lg: [] });
    }
  };

  const addTab = async () => {
    const res = await fetch("/api/pages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "New Tab" }) });
    const page = await res.json();
    setPages((p) => [...p, page]);
    setActivePageId(page.id);
    setWidgets([]);
    setLayouts({ lg: [] });
  };

  const commitRename = async (id: string) => {
    const name = renameDraft.trim() || "Untitled";
    setPages((p) => p.map((pg) => (pg.id === id ? { ...pg, name } : pg)));
    setRenamingTab(null);
    await fetch("/api/pages", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, name }) });
  };

  const deleteTab = async (id: string) => {
    if (pages.length <= 1) return;
    if (!confirm(`Delete tab "${pages.find((p) => p.id === id)?.name}"? This removes its widgets.`)) return;
    const remaining = pages.filter((p) => p.id !== id);
    setPages(remaining);
    await fetch(`/api/pages?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (activePageId === id) switchPage(remaining[0].id);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onLayoutChange = (_: any, all: any) => {
    const lg: LayoutItem[] = all.lg || [];
    setLayouts({ lg });
    save(widgets, lg);
  };

  const addWidget = (type: string) => {
    const id = `${type}-${Date.now()}`;
    const sizes = DEFAULT_SIZES[type] || { w: 4, h: 4, minW: 2, minH: 2 };
    const newWidget: WidgetDef = { id, type, config: {} };
    const newItem: LayoutItem = { i: id, x: 0, y: Infinity, ...sizes };
    const newWidgets = [...widgets, newWidget];
    const newLayout = [...layouts.lg, newItem];
    setWidgets(newWidgets);
    setLayouts({ lg: newLayout });
    save(newWidgets, newLayout);
  };

  const removeWidget = (id: string) => {
    const newWidgets = widgets.filter((w) => w.id !== id);
    const newLayout = layouts.lg.filter((l) => l.i !== id);
    setWidgets(newWidgets);
    setLayouts({ lg: newLayout });
    save(newWidgets, newLayout);
  };

  const updateConfig = (id: string, config: Record<string, unknown>) => {
    const newWidgets = widgets.map((w) => (w.id === id ? { ...w, config } : w));
    setWidgets(newWidgets);
    save(newWidgets, layouts.lg);
  };

  const updateMeta = (id: string, meta: WidgetMeta) => {
    const newWidgets = widgets.map((w) => (w.id === id ? { ...w, meta } : w));
    setWidgets(newWidgets);
    save(newWidgets, layouts.lg);
  };

  const handleSettingsChange = (s: DashboardSettings) => {
    setSettings(s);
    saveSettings(s);
    // Debounced save to the server so theme/appearance is shared across browsers
    if (settingsSaveTimer.current) clearTimeout(settingsSaveTimer.current);
    settingsSaveTimer.current = setTimeout(() => {
      fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(s) }).catch(() => {});
    }, 500);
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)" }}>
      {/* Top bar */}
      <div style={{ position: "sticky", top: 0, zIndex: 100, display: "flex", alignItems: "center", gap: 10, padding: "8px 16px", background: "rgba(13,17,23,0.85)", backdropFilter: "blur(12px)", borderBottom: "1px solid var(--border)" }}>
        {/* Optional title / company name, left of the tabs */}
        {(settings.showDashboardName ?? true) && settings.dashboardName && (
          <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text-primary)", letterSpacing: "-0.01em", flexShrink: 0, paddingRight: 6 }}>
            {settings.dashboardName}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1, minWidth: 0, overflowX: "auto" }}>
          {pages.map((page) => {
            const active = page.id === activePageId;
            return (
              <div
                key={page.id}
                onClick={() => switchPage(page.id)}
                onDoubleClick={() => { setRenamingTab(page.id); setRenameDraft(page.name); }}
                style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 8,
                  cursor: "pointer", fontSize: 13, whiteSpace: "nowrap", flexShrink: 0,
                  background: active ? "var(--bg-widget)" : "transparent",
                  color: active ? "var(--text-primary)" : "var(--text-muted)",
                  border: "1px solid " + (active ? "var(--border)" : "transparent"),
                  fontWeight: active ? 600 : 400,
                }}
              >
                {renamingTab === page.id ? (
                  <input
                    autoFocus
                    value={renameDraft}
                    onChange={(e) => setRenameDraft(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={() => commitRename(page.id)}
                    onKeyDown={(e) => { if (e.key === "Enter") commitRename(page.id); if (e.key === "Escape") setRenamingTab(null); }}
                    style={{ width: 90, background: "var(--bg-base)", border: "1px solid var(--accent)", borderRadius: 4, padding: "1px 6px", color: "var(--text-primary)", fontSize: 13, outline: "none" }}
                  />
                ) : (
                  <span title="Double-click to rename">{page.name}</span>
                )}
                {pages.length > 1 && renamingTab !== page.id && (
                  <button onClick={(e) => { e.stopPropagation(); deleteTab(page.id); }} title="Delete tab" style={{ display: "flex", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 0, opacity: active ? 0.7 : 0.4 }}>
                    <X size={12} />
                  </button>
                )}
              </div>
            );
          })}
          <button onClick={addTab} title="New tab" style={{ display: "flex", alignItems: "center", padding: "5px 8px", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", flexShrink: 0 }}>
            <Plus size={15} />
          </button>
        </div>
        {saving && <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>Saving…</span>}
        <button
          onClick={() => setShowAdd(true)}
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "5px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "rgba(88,166,255,0.1)", color: "var(--accent)", cursor: "pointer" }}
        >
          <Plus size={13} /> Add Widget
        </button>
        <button
          onClick={() => setShowSettings(true)}
          title="Settings"
          style={{ display: "flex", alignItems: "center", padding: "5px 8px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer" }}
        >
          <Settings size={14} />
        </button>
        {loggedIn ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-secondary)" }}>
              <User size={13} />
              <span style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userEmail}</span>
            </div>
            <a href="/api/auth/signout" style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", textDecoration: "none" }}>
              <LogOut size={11} /> Sign out
            </a>
          </div>
        ) : (
          <a href="/api/auth/signin" style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, padding: "5px 14px", borderRadius: 8, border: "1px solid rgba(88,166,255,0.4)", background: "rgba(88,166,255,0.1)", color: "var(--accent)", textDecoration: "none" }}>
            <LogIn size={13} /> Sign in with Google
          </a>
        )}
      </div>

      {/* Grid */}
      <div style={{ padding: "12px 8px" }}>
        <ResponsiveGrid
          key={activePageId}
          className="layout"
          layouts={allLayouts}
          breakpoints={{ lg: 1200, md: 768, sm: 480, xs: 0 }}
          cols={{ lg: 12, md: 8, sm: 4, xs: 2 }}
          rowHeight={settings.rowHeight}
          margin={[settings.gridGap, settings.gridGap]}
          containerPadding={[8, 8]}
          onLayoutChange={onLayoutChange}
          draggableHandle=".widget-grip"
          resizeHandles={["se"]}
          isResizable
          isDraggable
        >
          {widgets.map((widget) => (
            <WidgetWrapper
              key={widget.id}
              id={widget.id}
              type={widget.type}
              onRemove={removeWidget}
              globalShowHeader={settings.showWidgetHeaders}
              meta={widget.meta}
              onMetaChange={(m) => updateMeta(widget.id, m)}
            >
              {renderWidget(widget, loggedIn, updateConfig)}
            </WidgetWrapper>
          ))}
        </ResponsiveGrid>
      </div>

      {showAdd && <AddWidgetModal onAdd={addWidget} onClose={() => setShowAdd(false)} />}
      {showSettings && (
        <SettingsModal
          settings={settings}
          onChange={handleSettingsChange}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
