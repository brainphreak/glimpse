"use client";
import { useState, forwardRef, createContext, useContext, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import { X, Settings, Trash2, RefreshCw } from "lucide-react";

// Context lets child widgets inject: (a) toolbar buttons into the header bar,
// (b) widget-specific settings into the gear popover, (c) a refresh handler.
type Ctx = {
  setActions: (n: ReactNode) => void;
  setSettings: (n: ReactNode) => void;
  setRefresh: (fn: (() => void) | null) => void;
};
const WidgetHeaderCtx = createContext<Ctx | null>(null);

function useNodeInjector(which: "setActions" | "setSettings", node: ReactNode) {
  const ctx = useContext(WidgetHeaderCtx);
  const ref = useRef(node);
  ref.current = node;
  useEffect(() => {
    if (!ctx) return;
    ctx[which](ref.current);
    return () => ctx[which](null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx]);
  useEffect(() => { ctx?.[which](node); }, [node, ctx, which]);
}

// Inject toolbar buttons into the widget header bar
export function useWidgetHeader(actions: ReactNode) {
  useNodeInjector("setActions", actions);
}

// Inject widget-specific settings into the per-widget gear popover
export function useWidgetSettings(settings: ReactNode) {
  useNodeInjector("setSettings", settings);
}

// Register a refresh handler; the wrapper shows an always-visible refresh button.
export function useWidgetRefresh(fn: () => void) {
  const ctx = useContext(WidgetHeaderCtx);
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!ctx) return;
    ctx.setRefresh(() => ref.current?.());
    return () => ctx.setRefresh(null);
  }, [ctx]);
}

const DEFAULT_TITLES: Record<string, string> = {
  clock: "Clock", weather: "Weather", calendar: "Calendar", gmail: "Gmail",
  notes: "Notes", links: "Links", rss: "RSS Feed", reddit: "Reddit",
  "server-monitor": "Server Monitor", claude: "AI Chat", terminal: "Terminal",
  "daily-briefing": "Daily Briefing", "feed-digest": "Feed Digest", "ai-terminal": "AI Terminal",
  "world-clocks": "World Clocks", crypto: "Crypto", stocks: "Stocks", news: "News", github: "GitHub", docker: "Docker",
  "sys-health": "System Health", "read-later": "Read Later",
  html: "Custom HTML", image: "Image", iframe: "Embed",
};

export type HeaderMode = "global" | "show" | "hide";

export type WidgetMeta = {
  label?: string;
  showTitle?: boolean;
  headerMode?: HeaderMode;
};

type Props = React.HTMLAttributes<HTMLDivElement> & {
  id: string;
  type: string;
  onRemove: (id: string) => void;
  globalShowHeader?: boolean;
  meta?: WidgetMeta;
  onMetaChange?: (m: WidgetMeta) => void;
};

const WidgetWrapper = forwardRef<HTMLDivElement, Props>(
  ({ id, type, onRemove, children, globalShowHeader = false, meta = {}, onMetaChange, ...divProps }, ref) => {
    const [pinned, setPinned] = useState(false);
    const [actions, setActions] = useState<ReactNode>(null);
    const [settingsNode, setSettingsNode] = useState<ReactNode>(null);
    const [refreshFn, setRefreshFn] = useState<(() => void) | null>(null);
    const [spinning, setSpinning] = useState(false);
    const [gearOpen, setGearOpen] = useState(false);
    const [editing, setEditing] = useState(false);
    const [draftLabel, setDraftLabel] = useState("");
    const [popoverPos, setPopoverPos] = useState<{ top?: number; bottom?: number; right: number; maxH: number }>({ top: 0, right: 0, maxH: 400 });
    const wrapperRef = useRef<HTMLDivElement>(null);
    const gearBtnRef = useRef<HTMLButtonElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);

    const openGear = () => {
      const rect = gearBtnRef.current?.getBoundingClientRect();
      if (rect) {
        const margin = 8;
        const right = Math.max(margin, window.innerWidth - rect.right);
        const spaceBelow = window.innerHeight - rect.bottom - margin;
        const spaceAbove = rect.top - margin;
        // Open downward if there's room; otherwise flip upward so the (bottom) Remove button stays on screen.
        if (spaceBelow >= 320 || spaceBelow >= spaceAbove) {
          setPopoverPos({ top: rect.bottom + 6, right, maxH: Math.max(180, spaceBelow - 6) });
        } else {
          setPopoverPos({ bottom: window.innerHeight - rect.top + 6, right, maxH: Math.max(180, spaceAbove - 6) });
        }
      }
      setDraftLabel(label || "");
      setGearOpen((v) => !v);
    };

    const setRefresh = useCallback((fn: (() => void) | null) => setRefreshFn(() => fn), []);
    const ctxValue = useMemo<Ctx>(() => ({ setActions, setSettings: setSettingsNode, setRefresh }), [setRefresh]);

    const { label, showTitle = true, headerMode = "global" } = meta;

    const alwaysShow = headerMode === "show" || (headerMode === "global" && globalShowHeader);
    const headerVisible = alwaysShow || pinned;

    // Close pinned header / gear popover when clicking outside this widget
    useEffect(() => {
      if (!pinned && !gearOpen) return;
      const handler = (e: MouseEvent) => {
        const t = e.target as Node;
        const inWrapper = wrapperRef.current?.contains(t);
        const inPopover = popoverRef.current?.contains(t);
        if (!inWrapper && !inPopover) {
          setPinned(false);
          setGearOpen(false);
        }
      };
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }, [pinned, gearOpen]);

    const displayTitle = label || DEFAULT_TITLES[type] || type;

    const openEdit = (e: React.MouseEvent) => {
      e.stopPropagation();
      setDraftLabel(label || "");
      setEditing(true);
    };
    const saveEdit = (e: React.MouseEvent) => {
      e.stopPropagation();
      onMetaChange?.({ ...meta, label: draftLabel.trim() || undefined });
      setEditing(false);
    };

    const doRefresh = (e: React.MouseEvent) => {
      e.stopPropagation();
      refreshFn?.();
      setSpinning(true);
      setTimeout(() => setSpinning(false), 600);
    };

    const segBtn = (active: boolean, onClick: () => void, content: ReactNode, title?: string) => (
      <button onClick={onClick} title={title} style={{
        fontSize: 11, padding: "3px 9px", borderRadius: 5, border: "none", cursor: "pointer",
        background: active ? "var(--accent)" : "rgba(255,255,255,0.06)",
        color: active ? "#fff" : "var(--text-secondary)",
      }}>{content}</button>
    );

    const refreshBtn = () => (
      <button
        onClick={doRefresh}
        onMouseDown={(e) => e.stopPropagation()}
        title="Refresh"
        style={{ display: "flex", alignItems: "center", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 2 }}
      >
        <RefreshCw size={13} style={spinning ? { animation: "wgt-spin 0.6s linear" } : undefined} />
      </button>
    );

    return (
      <div ref={(el) => {
        (wrapperRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
        if (typeof ref === "function") ref(el);
        else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = el;
      }} {...divProps}>
        <WidgetHeaderCtx.Provider value={ctxValue}>
          <div className="widget" style={{ position: "relative" }}>
            <style>{`@keyframes wgt-spin { to { transform: rotate(360deg); } }`}</style>

            {/* Invisible 3px drag/click zone at the very top */}
            <div
              className="widget-grip"
              onClick={() => { if (!alwaysShow) setPinned((v) => !v); }}
              title="Drag to move · Click to toggle title bar"
              style={{ height: 3, cursor: "grab", flexShrink: 0, background: "transparent" }}
            />

            {/* Settings popover — portaled to body so it floats on top, unconstrained by the widget */}
            {gearOpen && createPortal(
              <div
                ref={popoverRef}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: "fixed", top: popoverPos.top, bottom: popoverPos.bottom, right: popoverPos.right, zIndex: 1000, width: 280, maxWidth: "calc(100vw - 16px)",
                  background: "var(--bg-widget)", border: "1px solid var(--border)", borderRadius: 10,
                  boxShadow: "0 12px 32px rgba(0,0,0,0.5)", padding: 12, display: "flex", flexDirection: "column", gap: 12,
                  maxHeight: popoverPos.maxH, overflow: "auto",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>Widget Settings</span>
                  <button onClick={() => setGearOpen(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 0, display: "flex" }}><X size={14} /></button>
                </div>

                {/* Title */}
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Title</div>
                  <input
                    value={draftLabel}
                    onChange={(e) => setDraftLabel(e.target.value)}
                    onBlur={() => onMetaChange?.({ ...meta, label: draftLabel.trim() || undefined })}
                    onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                    placeholder={DEFAULT_TITLES[type] || type}
                    style={{ width: "100%", background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 6, padding: "5px 8px", color: "var(--text-primary)", fontSize: 12, outline: "none", boxSizing: "border-box" }}
                  />
                </div>

                {/* Show title */}
                <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, color: "var(--text-secondary)", cursor: "pointer" }}>
                  Show title in header
                  <button onClick={() => onMetaChange?.({ ...meta, showTitle: !showTitle })} style={{ width: 36, height: 20, borderRadius: 10, border: "none", cursor: "pointer", background: showTitle ? "var(--accent)" : "var(--border)", position: "relative", flexShrink: 0 }}>
                    <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: showTitle ? 19 : 3, transition: "left 0.15s" }} />
                  </button>
                </label>

                {/* Header visibility */}
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Header bar</div>
                  <div style={{ display: "flex", gap: 4 }}>
                    {segBtn(headerMode === "global", () => onMetaChange?.({ ...meta, headerMode: "global" }), "Default", "Follow global setting")}
                    {segBtn(headerMode === "show", () => onMetaChange?.({ ...meta, headerMode: "show" }), "Show", "Always show header")}
                    {segBtn(headerMode === "hide", () => onMetaChange?.({ ...meta, headerMode: "hide" }), "Hide", "Always hide header")}
                  </div>
                </div>

                {/* Widget-specific settings */}
                {settingsNode && (
                  <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                    {settingsNode}
                  </div>
                )}

                {/* Remove */}
                <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                  <button onClick={() => { onRemove(id); setGearOpen(false); }} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--danger)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                    <Trash2 size={13} /> Remove widget
                  </button>
                </div>
              </div>,
              document.body
            )}

            {/* Collapsible header — title + injected actions + refresh + gear */}
            <div
              className="widget-header"
              style={{
                height: headerVisible ? undefined : 0,
                minHeight: headerVisible ? undefined : 0,
                padding: headerVisible ? undefined : 0,
                borderBottom: headerVisible ? undefined : "none",
                overflow: "hidden",
                opacity: headerVisible ? 1 : 0,
                pointerEvents: headerVisible ? "auto" : "none",
                transition: "height 0.15s, opacity 0.12s, padding 0.15s",
              }}
            >
              {editing ? (
                <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }} onMouseDown={(e) => e.stopPropagation()}>
                  <input
                    autoFocus
                    value={draftLabel}
                    onChange={(e) => setDraftLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEdit(e as unknown as React.MouseEvent);
                      if (e.key === "Escape") setEditing(false);
                    }}
                    placeholder={DEFAULT_TITLES[type] || type}
                    style={{ flex: 1, background: "var(--bg-base)", border: "1px solid var(--accent)", borderRadius: 4, padding: "2px 7px", color: "var(--text-primary)", fontSize: 11, outline: "none", minWidth: 0 }}
                  />
                  <button onClick={saveEdit} style={{ background: "none", border: "none", color: "var(--success)", cursor: "pointer", fontSize: 13 }}>✓</button>
                  <button onClick={(e) => { e.stopPropagation(); setEditing(false); }} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>✕</button>
                </div>
              ) : (
                <>
                  {showTitle && (
                    <span className="widget-title" onDoubleClick={openEdit} title="Double-click to rename" style={{ flexShrink: 0 }}>
                      {displayTitle}
                    </span>
                  )}

                  <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1, justifyContent: "flex-end" }}>
                    {actions}
                    {refreshFn && refreshBtn()}
                    <button
                      ref={gearBtnRef}
                      onClick={(e) => { e.stopPropagation(); openGear(); }}
                      onMouseDown={(e) => e.stopPropagation()}
                      title="Widget settings"
                      style={{ display: "flex", alignItems: "center", background: gearOpen ? "var(--accent)" : "none", border: "none", color: gearOpen ? "#fff" : "var(--text-muted)", cursor: "pointer", padding: 3, borderRadius: 5 }}
                    >
                      <Settings size={13} />
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="widget-body">{children}</div>
          </div>
        </WidgetHeaderCtx.Provider>
      </div>
    );
  }
);

WidgetWrapper.displayName = "WidgetWrapper";
export default WidgetWrapper;
