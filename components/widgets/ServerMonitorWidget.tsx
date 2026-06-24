"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { Plus, Trash2, Copy, Terminal, X, Check, AlertCircle, LayoutGrid, List } from "lucide-react";
import { useWidgetRefresh, useWidgetSettings } from "@/components/WidgetWrapper";

interface Server {
  id: number;
  name: string;
  check_url: string;
  ssh_host: string;
  ssh_user: string;
  ssh_port: number;
  sort_order: number;
  online?: boolean;
  latency?: number | null;
}

const BLANK = { name: "", check_url: "", ssh_host: "", ssh_user: "root", ssh_port: 22, sort_order: 0 };

const INTERVAL_OPTIONS = [
  { label: "30s",  value: 30 },
  { label: "1 min",  value: 60 },
  { label: "2 min",  value: 120 },
  { label: "5 min",  value: 300 },
  { label: "10 min", value: 600 },
  { label: "30 min", value: 1800 },
];

function fmtInterval(s: number) {
  return s < 60 ? `${s}s` : `${s / 60}m`;
}

export default function ServerMonitorWidget({
  config,
  onConfigChange,
}: {
  config?: { intervalSeconds?: number; tileMode?: boolean };
  onConfigChange?: (c: Record<string, unknown>) => void;
}) {
  const intervalSeconds = config?.intervalSeconds ?? 30;
  const tileMode = config?.tileMode ?? false;

  const [servers, setServers] = useState<Server[]>([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(BLANK);
  const [copied, setCopied] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dragId = useRef<number | null>(null);

  const load = useCallback(() =>
    fetch("/api/servers").then((r) => r.json()).then(setServers).catch(() => {}), []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(load, intervalSeconds * 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [load, intervalSeconds]);

  const create = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!draft.name.trim()) { setError("Name is required"); return; }
    if (!draft.check_url.trim()) { setError("Health check URL is required"); return; }
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, sort_order: servers.length }),
      });
      if (!res.ok) { setError("Save failed"); return; }
      setAdding(false);
      setDraft(BLANK);
      load();
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  const del = async (id: number) => {
    await fetch(`/api/servers/${id}`, { method: "DELETE" });
    load();
  };

  const copySSH = (server: Server) => {
    const port = server.ssh_port !== 22 ? ` -p ${server.ssh_port}` : "";
    navigator.clipboard.writeText(`ssh${port} ${server.ssh_user}@${server.ssh_host || server.check_url}`);
    setCopied(server.id);
    setTimeout(() => setCopied(null), 2000);
  };

  const cancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setAdding(false);
    setDraft(BLANK);
    setError("");
  };

  // Drag-to-reorder
  const onDragStart = (id: number) => { dragId.current = id; };
  const onDrop = async (targetId: number) => {
    const fromId = dragId.current;
    if (fromId === null || fromId === targetId) return;
    dragId.current = null;

    const fromIdx = servers.findIndex((s) => s.id === fromId);
    const toIdx = servers.findIndex((s) => s.id === targetId);
    const reordered = [...servers];
    reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, servers[fromIdx]);

    setServers(reordered.map((s, i) => ({ ...s, sort_order: i })));

    await Promise.all(
      reordered.map((s, i) =>
        fetch(`/api/servers/${s.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...s, sort_order: i }),
        })
      )
    );
  };

  useWidgetRefresh(load);

  const seg = (active: boolean) => ({
    display: "flex", alignItems: "center", gap: 4, fontSize: 11, padding: "4px 9px", borderRadius: 6,
    border: "1px solid var(--border)", cursor: "pointer",
    background: active ? "var(--accent)" : "transparent",
    color: active ? "#fff" : "var(--text-secondary)",
  } as React.CSSProperties);

  const fieldStyle: React.CSSProperties = { width: "100%", background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 6, padding: "5px 8px", color: "var(--text-primary)", fontSize: 12, outline: "none", boxSizing: "border-box" };

  useWidgetSettings(
    <>
      <div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>View</div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => onConfigChange?.({ ...config, tileMode: false })} style={seg(!tileMode)}><List size={12} /> List</button>
          <button onClick={() => onConfigChange?.({ ...config, tileMode: true })} style={seg(tileMode)}><LayoutGrid size={12} /> Tiles</button>
        </div>
      </div>
      <div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Check interval</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {INTERVAL_OPTIONS.map((opt) => (
            <button key={opt.value} onClick={() => onConfigChange?.({ ...config, intervalSeconds: opt.value })} style={seg(intervalSeconds === opt.value)}>{opt.label}</button>
          ))}
        </div>
      </div>
      <div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Add server</div>
        {!adding ? (
          <button onClick={() => setAdding(true)} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, padding: "5px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--accent)", cursor: "pointer" }}>
            <Plus size={12} /> Add server
          </button>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <input placeholder="Name *" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} style={fieldStyle} />
            <input placeholder="Health check URL *" value={draft.check_url} onChange={(e) => setDraft({ ...draft, check_url: e.target.value })} style={fieldStyle} />
            <input placeholder="SSH host/IP" value={draft.ssh_host} onChange={(e) => setDraft({ ...draft, ssh_host: e.target.value })} style={fieldStyle} />
            <input placeholder="SSH user (default: root)" value={draft.ssh_user} onChange={(e) => setDraft({ ...draft, ssh_user: e.target.value })} style={fieldStyle} />
            {error && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--danger)" }}>
                <AlertCircle size={12} /> {error}
              </div>
            )}
            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
              <button onClick={cancel} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}><X size={14} /></button>
              <button onClick={create} disabled={saving} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "var(--success)", cursor: "pointer", opacity: saving ? 0.5 : 1 }}>
                <Check size={14} /> {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {servers.filter((s) => s.online).length}/{servers.length} online
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>every {fmtInterval(intervalSeconds)}</span>
      </div>

      <div style={{ flex: 1, overflow: "auto" }}>
        {servers.length === 0 && (
          <div style={{ color: "var(--text-muted)", fontSize: 12, textAlign: "center", paddingTop: 20 }}>No servers — open the gear (settings) and use Add server</div>
        )}

        {tileMode ? (
          /* Tile / grid view */
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignContent: "start" }}>
            {servers.map((server) => (
              <div
                key={server.id}
                draggable
                onDragStart={() => onDragStart(server.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(server.id)}
                title={`${server.check_url}${server.latency != null ? ` — ${server.latency}ms` : server.online === false ? " — offline" : ""}`}
                style={{
                  width: 80, minHeight: 60, borderRadius: 10, padding: "8px 6px",
                  border: `1px solid ${server.online ? "rgba(63,185,80,0.4)" : server.online === false ? "rgba(248,81,73,0.4)" : "var(--border)"}`,
                  background: server.online ? "rgba(63,185,80,0.08)" : server.online === false ? "rgba(248,81,73,0.08)" : "rgba(255,255,255,0.02)",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5,
                  cursor: "grab", textAlign: "center",
                }}
              >
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: server.online ? "var(--success)" : server.online === false ? "var(--danger)" : "var(--text-muted)", flexShrink: 0 }} />
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)", wordBreak: "break-word", lineHeight: 1.2 }}>{server.name}</div>
                {server.online && server.latency != null && (
                  <div style={{ fontSize: 9, color: "var(--text-muted)" }}>{server.latency}ms</div>
                )}
                <button onClick={() => del(server.id)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 0, opacity: 0.5, marginTop: 2 }} onMouseOver={(e) => (e.currentTarget.style.opacity = "1")} onMouseOut={(e) => (e.currentTarget.style.opacity = "0.5")}><Trash2 size={10} /></button>
              </div>
            ))}
          </div>
        ) : (
          /* List view */
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {servers.map((server) => (
              <div
                key={server.id}
                draggable
                onDragStart={() => onDragStart(server.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(server.id)}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 10, border: `1px solid ${server.online ? "rgba(63,185,80,0.3)" : server.online === false ? "rgba(248,81,73,0.3)" : "var(--border)"}`, background: server.online ? "rgba(63,185,80,0.05)" : server.online === false ? "rgba(248,81,73,0.05)" : "rgba(255,255,255,0.02)", cursor: "grab" }}
              >
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: server.online ? "var(--success)" : server.online === false ? "var(--danger)" : "var(--text-muted)", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{server.name}</div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{server.check_url}</div>
                </div>
                <div style={{ fontSize: 10, color: server.online ? "var(--success)" : "var(--danger)", flexShrink: 0 }}>
                  {server.online ? `${server.latency}ms` : server.online === false ? "offline" : "…"}
                </div>
                {server.ssh_host && (
                  <>
                    <button onClick={() => copySSH(server)} title="Copy SSH command" style={{ background: "none", border: "none", color: copied === server.id ? "var(--success)" : "var(--text-muted)", cursor: "pointer", padding: 2 }}>
                      {copied === server.id ? <Check size={13} /> : <Copy size={13} />}
                    </button>
                    <button onClick={() => window.open(`ssh://${server.ssh_user}@${server.ssh_host}`, "_blank")} title="Open SSH" style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 2 }}>
                      <Terminal size={13} />
                    </button>
                  </>
                )}
                <button onClick={() => del(server.id)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 2 }}><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
