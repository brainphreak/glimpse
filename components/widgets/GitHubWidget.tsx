"use client";
import { useCallback, useEffect, useState } from "react";
import { ExternalLink, GitPullRequest, Bell } from "lucide-react";
import { useWidgetRefresh } from "@/components/WidgetWrapper";

interface Notif { id: string; reason: string; title: string; type: string; repo: string; repoUrl: string }
interface Pr { title: string; url: string; number: number; repo: string; draft?: boolean }

export default function GitHubWidget() {
  const [tab, setTab] = useState<"notifications" | "prs">("notifications");
  const [data, setData] = useState<{ login?: string; notifications: Notif[]; prs: Pr[] }>({ notifications: [], prs: [] });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/github").then((r) => r.json()).then((j) => { if (j.error) { setError(j.error); } else { setData(j); setError(""); } }).catch((e) => setError(String(e))).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);
  useWidgetRefresh(load);

  if (error) return <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", paddingTop: 16 }}>{error}</div>;

  const tabBtn = (id: typeof tab, icon: React.ReactNode, label: string, count: number) => (
    <button onClick={() => setTab(id)} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)", cursor: "pointer", background: tab === id ? "var(--accent)" : "transparent", color: tab === id ? "#fff" : "var(--text-secondary)" }}>
      {icon} {label} {count > 0 && <span style={{ fontSize: 10, opacity: 0.85 }}>({count})</span>}
    </button>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 8 }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        {tabBtn("notifications", <Bell size={11} />, "Inbox", data.notifications.length)}
        {tabBtn("prs", <GitPullRequest size={11} />, "My PRs", data.prs.length)}
        {data.login && <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--text-muted)" }}>@{data.login}</span>}
      </div>
      <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: 5 }}>
        {loading && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Loading…</div>}
        {!loading && tab === "notifications" && data.notifications.length === 0 && <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", paddingTop: 12 }}>Inbox zero 🎉</div>}
        {!loading && tab === "notifications" && data.notifications.map((n) => (
          <a key={n.id} href={n.repoUrl} target="_blank" rel="noopener noreferrer" style={{ display: "block", padding: "6px 8px", borderRadius: 8, border: "1px solid var(--border)", background: "rgba(255,255,255,0.02)", textDecoration: "none" }}>
            <div style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 500, lineHeight: 1.3 }}>{n.title}</div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{n.repo} · {n.reason.replace(/_/g, " ")}</div>
          </a>
        ))}
        {!loading && tab === "prs" && data.prs.length === 0 && <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", paddingTop: 12 }}>No open PRs.</div>}
        {!loading && tab === "prs" && data.prs.map((p) => (
          <a key={p.url} href={p.url} target="_blank" rel="noopener noreferrer" style={{ display: "block", padding: "6px 8px", borderRadius: 8, border: "1px solid var(--border)", background: "rgba(255,255,255,0.02)", textDecoration: "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
              <span style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 500, lineHeight: 1.3 }}>{p.title}</span>
              <ExternalLink size={10} color="var(--text-muted)" style={{ flexShrink: 0, marginTop: 2 }} />
            </div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{p.repo} #{p.number}{p.draft ? " · draft" : ""}</div>
          </a>
        ))}
      </div>
    </div>
  );
}
