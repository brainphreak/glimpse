"use client";
import { useCallback, useEffect, useState } from "react";
import { Mail, MailOpen, ExternalLink } from "lucide-react";
import { useWidgetRefresh } from "@/components/WidgetWrapper";

interface GmailMessage {
  id: string;
  subject: string;
  from: string;
  date: string;
  unread: boolean;
  snippet: string;
}

function parseFrom(from: string) {
  const match = from.match(/^"?([^"<]+)"?\s*<?[^>]*>?$/);
  return match ? match[1].trim() : from.split("@")[0];
}

export default function GmailWidget({ loggedIn }: { loggedIn: boolean }) {
  const [messages, setMessages] = useState<GmailMessage[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!loggedIn) { setLoading(false); return; }
    setError("");
    fetch("/api/gmail")
      .then((r) => r.json())
      .then((j) => {
        if (j.error) setError(j.error);
        else setMessages(j.messages || []);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [loggedIn]);

  useEffect(() => { load(); }, [load]);
  useWidgetRefresh(load);

  if (!loggedIn) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 8, color: "var(--text-secondary)", fontSize: 13 }}>
        <Mail size={24} color="var(--text-muted)" />
        <span>Sign in with Google to see Gmail</span>
        <a href="/api/auth/signin" style={{ color: "var(--accent)", textDecoration: "none", fontSize: 12 }}>Sign in →</a>
      </div>
    );
  }

  if (loading) return <div style={{ color: "var(--text-muted)", fontSize: 12 }}>Loading emails…</div>;
  if (error) return <div style={{ color: "var(--danger)", fontSize: 12 }}>{error}</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{messages.filter((m) => m.unread).length} unread</span>
        <a href="https://mail.google.com" target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "var(--accent)", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
          Open Gmail <ExternalLink size={10} />
        </a>
      </div>
      <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
        {messages.map((msg) => (
          <div key={msg.id} style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border)", background: msg.unread ? "rgba(88,166,255,0.06)" : "rgba(255,255,255,0.02)", display: "flex", gap: 8, alignItems: "flex-start" }}>
            <div style={{ flexShrink: 0, marginTop: 2 }}>
              {msg.unread ? <Mail size={13} color="var(--accent)" /> : <MailOpen size={13} color="var(--text-muted)" />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: msg.unread ? 600 : 400, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {parseFrom(msg.from)}
                </span>
                <span style={{ fontSize: 10, color: "var(--text-muted)", flexShrink: 0 }}>
                  {new Date(msg.date).toLocaleDateString([], { month: "short", day: "numeric" })}
                </span>
              </div>
              <div style={{ fontSize: 11, color: msg.unread ? "var(--text-primary)" : "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}>
                {msg.subject || "(No subject)"}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}>
                {msg.snippet}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
