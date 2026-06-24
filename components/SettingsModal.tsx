"use client";
import { useEffect, useRef, useState } from "react";
import { X, Check, Download, Upload, RefreshCw, Eye, EyeOff } from "lucide-react";

export interface ThemeVars {
  "--bg-base": string;
  "--bg-widget": string;
  "--bg-widget-hover": string;
  "--border": string;
  "--text-primary": string;
  "--text-secondary": string;
  "--text-muted": string;
  "--accent": string;
  "--accent-hover": string;
  "--success": string;
  "--warning": string;
  "--danger": string;
}

export interface DashboardSettings {
  showWidgetHeaders: boolean;
  gridGap: number;
  rowHeight: number;
  dashboardName: string;
  showDashboardName: boolean;
  theme: string;
  customTheme?: Partial<ThemeVars>;
}

export const THEMES: { id: string; name: string; vars: ThemeVars }[] = [
  { id: "default",  name: "Default",  vars: { "--bg-base": "#0d1117", "--bg-widget": "#161b22", "--bg-widget-hover": "#1c2128", "--border": "#30363d", "--text-primary": "#e6edf3", "--text-secondary": "#8b949e", "--text-muted": "#6e7681", "--accent": "#58a6ff", "--accent-hover": "#79b8ff", "--success": "#3fb950", "--warning": "#d29922", "--danger": "#f85149" } },
  { id: "light",    name: "Light",    vars: { "--bg-base": "#f6f8fa", "--bg-widget": "#ffffff", "--bg-widget-hover": "#f0f2f5", "--border": "#d0d7de", "--text-primary": "#1f2328", "--text-secondary": "#57606a", "--text-muted": "#8c959f", "--accent": "#0969da", "--accent-hover": "#0550ae", "--success": "#1a7f37", "--warning": "#9a6700", "--danger": "#d1242f" } },
  { id: "matrix",   name: "Matrix",   vars: { "--bg-base": "#000800", "--bg-widget": "#001200", "--bg-widget-hover": "#001a00", "--border": "#003300", "--text-primary": "#00ff41", "--text-secondary": "#00bb30", "--text-muted": "#007720", "--accent": "#00ff41", "--accent-hover": "#44ff77", "--success": "#00ff41", "--warning": "#aaff00", "--danger": "#ff2200" } },
  { id: "neon",     name: "Neon",     vars: { "--bg-base": "#0a0015", "--bg-widget": "#12002a", "--bg-widget-hover": "#1a0038", "--border": "#3d0080", "--text-primary": "#f0e6ff", "--text-secondary": "#c084fc", "--text-muted": "#7c3aed", "--accent": "#e879f9", "--accent-hover": "#f0abfc", "--success": "#4ade80", "--warning": "#facc15", "--danger": "#f43f5e" } },
  { id: "retro",    name: "Retro",    vars: { "--bg-base": "#1a0a00", "--bg-widget": "#2d1500", "--bg-widget-hover": "#3d1c00", "--border": "#6b3a0a", "--text-primary": "#ffcc88", "--text-secondary": "#cc8833", "--text-muted": "#8b5a1a", "--accent": "#ff9900", "--accent-hover": "#ffbb44", "--success": "#88cc00", "--warning": "#ffcc00", "--danger": "#ff3300" } },
  { id: "gameboy",  name: "Gameboy",  vars: { "--bg-base": "#0f380f", "--bg-widget": "#1a5c1a", "--bg-widget-hover": "#205c20", "--border": "#306230", "--text-primary": "#9bbc0f", "--text-secondary": "#8bac0f", "--text-muted": "#306230", "--accent": "#9bbc0f", "--accent-hover": "#b8d820", "--success": "#9bbc0f", "--warning": "#ffdd00", "--danger": "#d62828" } },
  { id: "midnight", name: "Midnight", vars: { "--bg-base": "#070b14", "--bg-widget": "#0e1628", "--bg-widget-hover": "#14203a", "--border": "#1e3055", "--text-primary": "#cdd9f5", "--text-secondary": "#7a93c8", "--text-muted": "#445d8a", "--accent": "#4d9de0", "--accent-hover": "#74b3e8", "--success": "#2ecc71", "--warning": "#f39c12", "--danger": "#e74c3c" } },
  { id: "dracula",  name: "Dracula",  vars: { "--bg-base": "#282a36", "--bg-widget": "#1e1f29", "--bg-widget-hover": "#2d2f3e", "--border": "#44475a", "--text-primary": "#f8f8f2", "--text-secondary": "#6272a4", "--text-muted": "#44475a", "--accent": "#bd93f9", "--accent-hover": "#caa9ff", "--success": "#50fa7b", "--warning": "#f1fa8c", "--danger": "#ff5555" } },
  { id: "custom",   name: "Custom",   vars: { "--bg-base": "#0d1117", "--bg-widget": "#161b22", "--bg-widget-hover": "#1c2128", "--border": "#30363d", "--text-primary": "#e6edf3", "--text-secondary": "#8b949e", "--text-muted": "#6e7681", "--accent": "#58a6ff", "--accent-hover": "#79b8ff", "--success": "#3fb950", "--warning": "#d29922", "--danger": "#f85149" } },
];

export const DEFAULT_SETTINGS: DashboardSettings = {
  showWidgetHeaders: false,
  gridGap: 10,
  rowHeight: 50,
  dashboardName: "Dashboard",
  showDashboardName: true,
  theme: "default",
};

export function loadSettings(): DashboardSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem("dashboard_settings");
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch { return DEFAULT_SETTINGS; }
}

export function saveSettings(s: DashboardSettings) {
  localStorage.setItem("dashboard_settings", JSON.stringify(s));
}

export function applyTheme(settings: DashboardSettings) {
  if (typeof document === "undefined") return;
  const preset = THEMES.find((t) => t.id === settings.theme) ?? THEMES[0];
  const vars: ThemeVars = settings.customTheme ? { ...preset.vars, ...settings.customTheme } : preset.vars;
  const root = document.documentElement;
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
}

interface Props {
  settings: DashboardSettings;
  onChange: (s: DashboardSettings) => void;
  onClose: () => void;
}

function Toggle({ label, desc, checked, onChange }: { label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
      <div>
        <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{label}</div>
        {desc && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{desc}</div>}
      </div>
      <button onClick={() => onChange(!checked)} style={{ width: 40, height: 22, borderRadius: 11, border: "none", cursor: "pointer", background: checked ? "var(--accent)" : "var(--border)", position: "relative", transition: "background 0.2s", flexShrink: 0, marginLeft: 16 }}>
        <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: checked ? 21 : 3, transition: "left 0.2s" }} />
      </button>
    </div>
  );
}

function Slider({ label, min, max, step = 1, value, onChange }: { label: string; min: number; max: number; step?: number; value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{value}px</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ width: "100%", accentColor: "var(--accent)" }} />
    </div>
  );
}

function ThemePreview({ vars }: { vars: ThemeVars }) {
  return (
    <div style={{ width: 32, height: 22, borderRadius: 4, border: `2px solid ${vars["--border"]}`, background: vars["--bg-base"], display: "flex", gap: 2, padding: 3, overflow: "hidden", flexShrink: 0 }}>
      <div style={{ flex: 1, borderRadius: 2, background: vars["--bg-widget"] }} />
      <div style={{ width: 6, borderRadius: 2, background: vars["--accent"] }} />
    </div>
  );
}

// A config field that shows ●●●● when a secret is already set, and lets you enter a new value
function SecretField({ label, desc, isSet, onSave }: { label: string; desc?: string; isSet: boolean; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState("");
  const [show, setShow] = useState(false);

  const save = () => { onSave(val); setEditing(false); setVal(""); };
  const cancel = () => { setEditing(false); setVal(""); };

  if (!editing) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
        <div>
          <div style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 500 }}>{label}</div>
          {desc && <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}>{desc}</div>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isSet
            ? <span style={{ fontSize: 11, color: "var(--success)" }}>✓ Set</span>
            : <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Not set</span>
          }
          <button onClick={() => setEditing(true)} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 5, border: "1px solid var(--border)", background: "transparent", color: "var(--accent)", cursor: "pointer" }}>
            {isSet ? "Change" : "Set"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
      <div style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 500, marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", gap: 6 }}>
        <div style={{ flex: 1, position: "relative" }}>
          <input
            type={show ? "text" : "password"}
            autoFocus
            value={val}
            onChange={(e) => setVal(e.target.value)}
            placeholder={isSet ? "Enter new value to replace" : "Enter value…"}
            style={{ width: "100%", background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 6, padding: "5px 30px 5px 8px", color: "var(--text-primary)", fontSize: 12, outline: "none", boxSizing: "border-box" }}
          />
          <button onClick={() => setShow(s => !s)} style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 0 }}>
            {show ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
        </div>
        <button onClick={cancel} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}><X size={14} /></button>
        <button onClick={save} style={{ background: "none", border: "none", color: "var(--success)", cursor: "pointer" }}><Check size={14} /></button>
      </div>
    </div>
  );
}

function PlainField({ label, desc, value, onSave, placeholder }: { label: string; desc?: string; value: string; onSave: (v: string) => void; placeholder?: string }) {
  const [val, setVal] = useState(value);
  useEffect(() => setVal(value), [value]);
  return (
    <div style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
      <div style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 500, marginBottom: 6 }}>{label}</div>
      {desc && <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4 }}>{desc}</div>}
      <div style={{ display: "flex", gap: 6 }}>
        <input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSave(val)}
          placeholder={placeholder}
          style={{ flex: 1, background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 6, padding: "5px 8px", color: "var(--text-primary)", fontSize: 12, outline: "none" }}
        />
        <button onClick={() => onSave(val)} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer" }}>Save</button>
      </div>
    </div>
  );
}

function SetupTab() {
  const [cfg, setCfg] = useState<Record<string, string | boolean>>({});
  const [saved, setSaved] = useState<string | null>(null);
  const [authSecret, setAuthSecret] = useState("");

  useEffect(() => {
    fetch("/api/config").then(r => r.json()).then(setCfg);
  }, []);

  const save = async (key: string, value: string) => {
    await fetch("/api/config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [key]: value }) });
    setCfg(prev => ({ ...prev, [key]: value ? true : false }));
    setSaved(key);
    setTimeout(() => setSaved(null), 2000);
  };

  const generateSecret = () => {
    const arr = new Uint8Array(32);
    crypto.getRandomValues(arr);
    const secret = btoa(String.fromCharCode(...arr));
    setAuthSecret(secret);
  };

  const sectionHead = (title: string, note?: string) => (
    <div style={{ marginTop: 16, marginBottom: 4 }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>{title}</div>
      {note && <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{note}</div>}
    </div>
  );

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "0 32px", alignItems: "start" }}>
        {/* Column 1 — Authentication */}
        <div>
          {sectionHead("Authentication", "Required for Google sign-in (Gmail & Calendar widgets)")}

          <div style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
            <div style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 500, marginBottom: 4 }}>Auth Secret</div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 6 }}>Random secret used to sign session tokens. Generate one and save it.</div>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                type="password"
                value={authSecret}
                onChange={(e) => setAuthSecret(e.target.value)}
                placeholder={cfg.auth_secret ? "●●●●●●●● (already set)" : "Paste or generate a secret…"}
                style={{ flex: 1, minWidth: 0, background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 6, padding: "5px 8px", color: "var(--text-primary)", fontSize: 12, outline: "none" }}
              />
              <button onClick={generateSecret} title="Generate random secret" style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer" }}>
                <RefreshCw size={11} />
              </button>
              <button onClick={() => authSecret && save("auth_secret", authSecret)} disabled={!authSecret} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "none", background: authSecret ? "var(--accent)" : "var(--border)", color: "#fff", cursor: authSecret ? "pointer" : "default" }}>
                {saved === "auth_secret" ? "Saved!" : "Save"}
              </button>
            </div>
            {cfg.auth_secret && <div style={{ fontSize: 10, color: "var(--success)", marginTop: 4 }}>✓ Auth secret is set</div>}
          </div>

          <PlainField
            label="Google Client ID"
            desc="From Google Cloud Console → Credentials → OAuth 2.0 Client ID"
            value={typeof cfg.google_client_id === "string" ? cfg.google_client_id : ""}
            onSave={(v) => save("google_client_id", v)}
            placeholder="123456789-abc.apps.googleusercontent.com"
          />
          <SecretField
            label="Google Client Secret"
            desc="Keep this private"
            isSet={!!cfg.google_client_secret}
            onSave={(v) => save("google_client_secret", v)}
          />

          <div style={{ marginTop: 8, padding: "8px 10px", background: "rgba(88,166,255,0.07)", borderRadius: 8, fontSize: 11, color: "var(--text-muted)", lineHeight: 1.6, wordBreak: "break-all" }}>
            Set the OAuth redirect URI in Google Cloud Console to:<br />
            <code style={{ color: "var(--accent)" }}>{typeof window !== "undefined" ? window.location.origin : ""}/api/auth/callback/google</code>
          </div>
        </div>

        {/* Column 2 — Services */}
        <div>
          {sectionHead("Weather", "Optional — falls back to wttr.in (no key needed) if not set")}
          <SecretField
            label="OpenWeatherMap API Key"
            desc="Free key from openweathermap.org/api"
            isSet={!!cfg.openweathermap_api_key}
            onSave={(v) => save("openweathermap_api_key", v)}
          />
          <PlainField
            label="Default city"
            value={typeof cfg.weather_city === "string" ? cfg.weather_city : ""}
            onSave={(v) => save("weather_city", v)}
            placeholder="New York"
          />

          {sectionHead("AI widgets", "Power the Claude chat, Daily Briefing, Feed Digest, and AI Terminal widgets")}
          <SecretField
            label="Anthropic API Key"
            desc="From console.anthropic.com — enables Claude models"
            isSet={!!cfg.anthropic_api_key}
            onSave={(v) => save("anthropic_api_key", v)}
          />
          <PlainField
            label="Ollama URL"
            desc="Your local Ollama server. The browser calls it directly. Set OLLAMA_ORIGINS so it accepts requests from this dashboard's origin."
            value={typeof cfg.ollama_url === "string" ? cfg.ollama_url : ""}
            onSave={(v) => save("ollama_url", v)}
            placeholder="http://localhost:11434"
          />
          <div style={{ marginTop: 4, padding: "8px 10px", background: "rgba(88,166,255,0.07)", borderRadius: 8, fontSize: 10, color: "var(--text-muted)", lineHeight: 1.6 }}>
            Ollama runs on <b>your machine</b>, so the dashboard talks to it from your browser, not the server. For it to work, start Ollama with CORS allowed for this site, e.g.<br />
            <code style={{ color: "var(--accent)" }}>OLLAMA_ORIGINS=&quot;{typeof window !== "undefined" ? window.location.origin : "*"}&quot; ollama serve</code>
          </div>

          {sectionHead("GitHub widget (optional)", "Personal access token for the GitHub notifications / PRs widget")}
          <SecretField
            label="GitHub Token"
            desc="github.com/settings/tokens — needs notifications + repo scope"
            isSet={!!cfg.github_token}
            onSave={(v) => save("github_token", v)}
          />

          {sectionHead("Reddit widget (optional)", "Reddit now requires an app. Create one at reddit.com/prefs/apps (type: script or web app).")}
          <PlainField
            label="Reddit Client ID"
            desc="The short string under the app name"
            value={typeof cfg.reddit_client_id === "string" ? cfg.reddit_client_id : ""}
            onSave={(v) => save("reddit_client_id", v)}
            placeholder="Ab3xYz..."
          />
          <SecretField
            label="Reddit Client Secret"
            desc="The 'secret' value from your Reddit app"
            isSet={!!cfg.reddit_client_secret}
            onSave={(v) => save("reddit_client_secret", v)}
          />

          {sectionHead("n8n (optional)", "Only needed if you use n8n webhooks in Server Monitor")}
          <PlainField
            label="n8n URL"
            value={typeof cfg.n8n_url === "string" ? cfg.n8n_url : ""}
            onSave={(v) => save("n8n_url", v)}
            placeholder="https://your-n8n.example.com"
          />
          <SecretField
            label="n8n API Key"
            isSet={!!cfg.n8n_api_key}
            onSave={(v) => save("n8n_api_key", v)}
          />

          {sectionHead("Terminal", "Customizes the Bash prompt. Start a fresh session (↻ in the widget) to apply.")}
          <PlainField
            label="Username"
            desc="Shown before @ in the prompt"
            value={typeof cfg.terminal_user === "string" ? cfg.terminal_user : ""}
            onSave={(v) => save("terminal_user", v)}
            placeholder="user"
          />
          <PlainField
            label="Hostname"
            desc="Shown after @ in the prompt"
            value={typeof cfg.terminal_host === "string" ? cfg.terminal_host : ""}
            onSave={(v) => save("terminal_host", v)}
            placeholder="user"
          />
          <PlainField
            label="Home directory"
            desc="Bash starts here (created if missing). Defaults to /home/<username>."
            value={typeof cfg.terminal_home === "string" ? cfg.terminal_home : ""}
            onSave={(v) => save("terminal_home", v)}
            placeholder="/home/user"
          />
        </div>
      </div>

      <div style={{ marginTop: 16, padding: "10px", background: "rgba(255,255,255,0.03)", borderRadius: 8, fontSize: 11, color: "var(--text-muted)", lineHeight: 1.6 }}>
        All values are stored in the SQLite database and take effect immediately without restarting the server. Environment variables in <code>.env.local</code> are still read as fallback if no value is saved here.
      </div>
    </div>
  );
}

export default function SettingsModal({ settings, onChange, onClose }: Props) {
  const [tab, setTab] = useState<"appearance" | "general" | "setup">("general");
  const [customJson, setCustomJson] = useState(settings.customTheme ? JSON.stringify(settings.customTheme, null, 2) : "");
  const [jsonError, setJsonError] = useState("");
  const [importStatus, setImportStatus] = useState<"idle" | "ok" | "err">("idle");
  const importRef = useRef<HTMLInputElement>(null);

  const exportData = async () => {
    const res = await fetch("/api/export");
    const data = await res.json();
    data.dashboardSettings = settings;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `dashboard-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const importData = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (data.dashboardSettings) { onChange(data.dashboardSettings); saveSettings(data.dashboardSettings); applyTheme(data.dashboardSettings); }
      const res = await fetch("/api/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error("Import failed");
      setImportStatus("ok");
      setTimeout(() => { setImportStatus("idle"); window.location.reload(); }, 1200);
    } catch {
      setImportStatus("err");
      setTimeout(() => setImportStatus("idle"), 3000);
    } finally { if (importRef.current) importRef.current.value = ""; }
  };

  const update = (patch: Partial<DashboardSettings>) => {
    const next = { ...settings, ...patch };
    onChange(next); saveSettings(next); applyTheme(next);
  };

  const applyCustomJson = () => {
    try { setJsonError(""); update({ theme: "custom", customTheme: JSON.parse(customJson) }); }
    catch { setJsonError("Invalid JSON"); }
  };

  const tabBtn = (id: typeof tab, label: string) => (
    <button
      onClick={() => setTab(id)}
      style={{ fontSize: 12, fontWeight: 600, padding: "6px 14px", borderRadius: 7, border: "none", cursor: "pointer", background: tab === id ? "var(--accent)" : "transparent", color: tab === id ? "#fff" : "var(--text-muted)" }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--bg-widget)", border: "1px solid var(--border)", borderRadius: 14, padding: 24, width: 880, maxWidth: "94vw", maxHeight: "88vh", overflow: "auto", display: "flex", flexDirection: "column", gap: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>Settings</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}><X size={18} /></button>
        </div>

        {/* Tab bar */}
        <div style={{ display: "flex", gap: 4, marginBottom: 16, padding: 3, background: "var(--bg-base)", borderRadius: 9, width: "fit-content" }}>
          {tabBtn("general", "General")}
          {tabBtn("appearance", "Appearance")}
          {tabBtn("setup", "Setup")}
        </div>

        {tab === "setup" && <SetupTab />}

        {tab === "appearance" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "0 32px", alignItems: "start" }}>
            {/* Left column — theme presets + JSON */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: 8 }}>Theme</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
                {THEMES.filter((t) => t.id !== "custom").map((theme) => (
                  <button key={theme.id} onClick={() => update({ theme: theme.id, customTheme: undefined })} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, border: `1px solid ${settings.theme === theme.id ? "var(--accent)" : "var(--border)"}`, background: settings.theme === theme.id ? "rgba(88,166,255,0.08)" : "transparent", cursor: "pointer", textAlign: "left" }}>
                    <div style={{ width: 32, height: 22, borderRadius: 4, border: `2px solid ${theme.vars["--border"]}`, background: theme.vars["--bg-base"], display: "flex", gap: 2, padding: 3, overflow: "hidden", flexShrink: 0 }}>
                      <div style={{ flex: 1, borderRadius: 2, background: theme.vars["--bg-widget"] }} />
                      <div style={{ width: 6, borderRadius: 2, background: theme.vars["--accent"] }} />
                    </div>
                    <span style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 500 }}>{theme.name}</span>
                    {settings.theme === theme.id && <Check size={12} color="var(--accent)" style={{ marginLeft: "auto" }} />}
                  </button>
                ))}
              </div>

              {/* Custom theme JSON */}
              <div style={{ padding: "10px 0" }}>
                <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500, marginBottom: 4 }}>Custom theme (JSON)</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>Paste full CSS variable overrides to import a theme.</div>
                <textarea value={customJson} onChange={(e) => setCustomJson(e.target.value)} rows={4} placeholder={'{\n  "--accent": "#ff6b6b",\n  "--bg-base": "#1a1a2e"\n}'}
                  style={{ width: "100%", background: "var(--bg-base)", border: `1px solid ${jsonError ? "var(--danger)" : "var(--border)"}`, borderRadius: 6, padding: "6px 10px", color: "var(--text-primary)", fontSize: 11, fontFamily: "monospace", outline: "none", resize: "vertical", boxSizing: "border-box" }} />
                {jsonError && <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 4 }}>{jsonError}</div>}
                <button onClick={applyCustomJson} style={{ marginTop: 6, fontSize: 11, padding: "4px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--accent)", cursor: "pointer" }}>Apply JSON theme</button>
              </div>
            </div>

            {/* Right column — color customizer */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: 8 }}>Customize colors</div>
              {([["Background", "--bg-base"], ["Widget background", "--bg-widget"], ["Border", "--border"], ["Text", "--text-primary"], ["Secondary text", "--text-secondary"], ["Muted text", "--text-muted"], ["Accent / links", "--accent"], ["Success", "--success"], ["Danger", "--danger"]] as [string, keyof ThemeVars][]).map(([label, key]) => {
                const activePreset = THEMES.find((t) => t.id === settings.theme) ?? THEMES[0];
                const currentVal = (settings.customTheme?.[key] ?? activePreset.vars[key]) as string;
                return (
                  <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{label}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <code style={{ fontSize: 10, color: "var(--text-muted)" }}>{currentVal}</code>
                      <input type="color" value={currentVal} onChange={(e) => { const next = { ...settings, customTheme: { ...(settings.customTheme ?? {}), [key]: e.target.value } }; onChange(next); saveSettings(next); applyTheme(next); }}
                        style={{ width: 32, height: 24, padding: 1, border: "1px solid var(--border)", borderRadius: 4, cursor: "pointer", background: "transparent" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === "general" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "0 32px", alignItems: "start" }}>
            {/* Left — general + layout */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: 4 }}>General</div>
              <div style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500, marginBottom: 6 }}>Title / company name</div>
                <input value={settings.dashboardName} onChange={(e) => update({ dashboardName: e.target.value })} placeholder="e.g. Amador IT"
                  style={{ width: "100%", background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 6, padding: "5px 10px", color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>Shown to the left of the tabs in the top bar.</div>
              </div>
              <Toggle label="Show title" desc="Display the title/company name in the top bar." checked={settings.showDashboardName ?? true} onChange={(v) => update({ showDashboardName: v })} />

              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginTop: 16, marginBottom: 0 }}>Layout</div>
              <Toggle label="Show widget headers" desc="Always show title bar. When off, headers appear on click only." checked={settings.showWidgetHeaders} onChange={(v) => update({ showWidgetHeaders: v })} />
              <Slider label="Grid row height" min={30} max={80} step={5} value={settings.rowHeight} onChange={(v) => update({ rowHeight: v })} />
              <Slider label="Widget gap" min={4} max={24} step={2} value={settings.gridGap} onChange={(v) => update({ gridGap: v })} />
            </div>

            {/* Right — backup */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: 8 }}>Backup</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <button onClick={exportData} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-primary)", cursor: "pointer" }}>
                  <Download size={13} /> Export all data
                </button>
                <button onClick={() => importRef.current?.click()} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-primary)", cursor: "pointer" }}>
                  <Upload size={13} />
                  {importStatus === "ok" ? "Imported! Reloading…" : importStatus === "err" ? "Import failed" : "Import backup"}
                </button>
                <input ref={importRef} type="file" accept=".json" style={{ display: "none" }} onChange={importData} />
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
                Export saves layout, notes, links, servers, and theme settings. Import restores all of it and reloads the page.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
