"use client";
import { useCallback, useEffect, useState } from "react";
import { Cpu, MemoryStick, Clock, Server } from "lucide-react";
import { useWidgetRefresh } from "@/components/WidgetWrapper";

interface Info {
  hostname: string; platform: string; release: string; uptime: number;
  loadavg: number[]; cpus: number; memTotal: number; memUsed: number;
}

function fmtUptime(s: number) {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return [d && `${d}d`, h && `${h}h`, `${m}m`].filter(Boolean).join(" ");
}
function fmtGB(bytes: number) { return (bytes / 1024 ** 3).toFixed(1) + " GB"; }

export default function SysHealthWidget() {
  const [info, setInfo] = useState<Info | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    fetch("/api/sysinfo").then((r) => r.json()).then((j) => { if (j.error) setError(j.error); else { setInfo(j); setError(""); } }).catch((e) => setError(String(e)));
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, [load]);
  useWidgetRefresh(load);

  if (error) return <div style={{ fontSize: 12, color: "var(--danger)" }}>{error}</div>;
  if (!info) return <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Loading…</div>;

  const memPct = Math.round((info.memUsed / info.memTotal) * 100);
  const load1 = info.loadavg[0] ?? 0;
  const loadPct = Math.min(100, Math.round((load1 / info.cpus) * 100));
  const bar = (pct: number, color: string) => (
    <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, transition: "width 0.4s" }} />
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 10, justifyContent: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-secondary)" }}>
        <Server size={13} /> <b style={{ color: "var(--text-primary)" }}>{info.hostname}</b>
        <span style={{ color: "var(--text-muted)" }}>· {info.platform} {info.release}</span>
      </div>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-secondary)", marginBottom: 3 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Cpu size={11} /> Load ({info.cpus} cpu)</span>
          <span>{load1.toFixed(2)}</span>
        </div>
        {bar(loadPct, loadPct > 85 ? "var(--danger)" : loadPct > 60 ? "var(--warning)" : "var(--success)")}
      </div>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-secondary)", marginBottom: 3 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}><MemoryStick size={11} /> Memory</span>
          <span>{fmtGB(info.memUsed)} / {fmtGB(info.memTotal)} ({memPct}%)</span>
        </div>
        {bar(memPct, memPct > 85 ? "var(--danger)" : memPct > 60 ? "var(--warning)" : "var(--accent)")}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--text-secondary)" }}>
        <Clock size={12} /> Uptime <b style={{ color: "var(--text-primary)" }}>{fmtUptime(info.uptime)}</b>
      </div>
    </div>
  );
}
