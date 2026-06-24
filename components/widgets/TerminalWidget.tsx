"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { Power, PowerOff, Maximize2, Minimize2, RotateCcw } from "lucide-react";

const PRESETS = [
  { label: "Claude", cmd: "claude" },
  { label: "Bash", cmd: "bash" },
];

export default function TerminalWidget({ config, onConfigChange }: { config: { cmd?: string; fullscreen?: boolean }; onConfigChange?: (c: Record<string, unknown>) => void }) {
  const termRef = useRef<HTMLDivElement>(null);
  const termInstance = useRef<unknown>(null);
  const fitAddon = useRef<unknown>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [cmd, setCmd] = useState(config.cmd || "claude");
  const [fullscreen, setFullscreen] = useState(config.fullscreen ?? false);

  const toggleFullscreen = () => {
    setFullscreen((f) => {
      const next = !f;
      onConfigChange?.({ ...config, fullscreen: next });
      return next;
    });
  };

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setConnected(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (termInstance.current as any)?.write("\r\n\x1b[33m[detached — session still running on server]\x1b[0m\r\n");
  }, []);

  const connect = useCallback(async (command: string, sessionName?: string) => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const { Terminal } = await import("@xterm/xterm");
    const { FitAddon } = await import("@xterm/addon-fit");
    const { WebLinksAddon } = await import("@xterm/addon-web-links");
    await import("@xterm/xterm/css/xterm.css");

    if (!termRef.current) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (termInstance.current as any)?.dispose();

    const term = new Terminal({
      theme: {
        background: "#0d1117", foreground: "#e6edf3", cursor: "#58a6ff", cursorAccent: "#0d1117",
        selectionBackground: "rgba(88,166,255,0.3)",
        black: "#484f58", red: "#ff7b72", green: "#3fb950", yellow: "#d29922",
        blue: "#58a6ff", magenta: "#bc8cff", cyan: "#39c5cf", white: "#b1bac4",
        brightBlack: "#6e7681", brightRed: "#ffa198", brightGreen: "#56d364",
        brightYellow: "#e3b341", brightBlue: "#79c0ff", brightMagenta: "#d2a8ff",
        brightCyan: "#56d4dd", brightWhite: "#f0f6fc",
      },
      fontFamily: '"Cascadia Code", "Fira Code", "JetBrains Mono", monospace',
      fontSize: 13, lineHeight: 1.2, cursorBlink: true, scrollback: 5000,
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon());
    term.open(termRef.current);
    fit.fit();

    termInstance.current = term;
    fitAddon.current = fit;

    // Disable the application's mouse-capture (DECSET 1000–1016) so click-drag does
    // local text selection instead of being sent to the TUI. This lets you highlight
    // and copy code/commands out of Claude. Bracketed-paste / alt-screen are untouched.
    const MOUSE_MODES = new Set([1000, 1001, 1002, 1003, 1005, 1006, 1015, 1016]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isMouse = (params: any[]) => params.some((p) => MOUSE_MODES.has(Array.isArray(p) ? p[0] : p));
    term.parser.registerCsiHandler({ prefix: "?", final: "h" }, (params) => isMouse(params));
    term.parser.registerCsiHandler({ prefix: "?", final: "l" }, (params) => isMouse(params));

    // Selecting text immediately copies it to the clipboard (like a native terminal).
    term.onSelectionChange(() => {
      const sel = term.getSelection();
      if (sel) navigator.clipboard?.writeText(sel).catch(() => {});
    });

    const ro = new ResizeObserver(() => { try { fit.fit(); } catch {} });
    ro.observe(termRef.current);

    const session = sessionName || command;
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(
      `${proto}//${location.host}/_terminal?cmd=${encodeURIComponent(command)}&session=${encodeURIComponent(session)}`
    );
    wsRef.current = ws;

    // Clipboard: ⌘C / Ctrl+Shift+C copies the selection; ⌘V / Ctrl+Shift+V pastes.
    term.attachCustomKeyEventHandler((e: KeyboardEvent) => {
      if (e.type !== "keydown") return true;
      const mod = e.metaKey || (e.ctrlKey && e.shiftKey);
      if (!mod) return true;
      const key = e.key.toLowerCase();
      if (key === "c") {
        const sel = term.getSelection();
        if (sel) { navigator.clipboard?.writeText(sel); return false; }
      }
      if (key === "v") {
        navigator.clipboard?.readText().then((t) => {
          if (t && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "data", data: t }));
        });
        return false;
      }
      return true;
    });

    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
    };

    ws.onmessage = (e) => term.write(e.data);

    ws.onclose = () => {
      setConnected(false);
      term.write("\r\n\x1b[31m[session ended]\x1b[0m\r\n");
      ro.disconnect();
    };

    ws.onerror = () => term.write("\r\n\x1b[31m[connection error]\x1b[0m\r\n");

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "data", data }));
    });

    term.onResize(({ cols, rows }) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "resize", cols, rows }));
    });
  }, []);

  const newSession = useCallback(async (command: string) => {
    // Kill the existing tmux session on the server, then reconnect (starts fresh)
    try {
      await fetch(`/_terminal/kill?session=${encodeURIComponent(command)}`, { method: "POST" });
    } catch {}
    connect(command);
  }, [connect]);

  useEffect(() => {
    connect(cmd);
    return () => { wsRef.current?.close(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setTimeout(() => { try { (fitAddon.current as { fit(): void })?.fit(); } catch {} }, 100);
  }, [fullscreen]);

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%",
      ...(fullscreen ? { position: "fixed", inset: 0, zIndex: 999, background: "var(--bg-base)", padding: 0, borderRadius: 0 } : {}),
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexShrink: 0 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: connected ? "var(--success)" : "var(--danger)", flexShrink: 0 }} />
        <div style={{ display: "flex", gap: 4 }}>
          {PRESETS.map((p) => (
            <button key={p.cmd} onClick={() => { setCmd(p.cmd); connect(p.cmd); }} style={{
              fontSize: 10, padding: "2px 8px", borderRadius: 4, border: "1px solid var(--border)",
              background: cmd === p.cmd ? "var(--accent)" : "transparent",
              color: cmd === p.cmd ? "#fff" : "var(--text-muted)", cursor: "pointer",
            }}>
              {p.label}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => newSession(cmd)}
          title="Kill session and start fresh"
          style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 2, display: "flex", alignItems: "center" }}
        >
          <RotateCcw size={13} />
        </button>
        <button
          onClick={toggleFullscreen}
          style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 2 }}
        >
          {fullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
        </button>
        <button
          onClick={() => connected ? disconnect() : connect(cmd)}
          title={connected ? "Detach (session keeps running)" : "Reconnect to session"}
          style={{ background: "none", border: "none", color: connected ? "var(--warning)" : "var(--success)", cursor: "pointer", padding: 2 }}
        >
          {connected ? <PowerOff size={13} /> : <Power size={13} />}
        </button>
      </div>

      <div ref={termRef} style={{
        flex: 1, overflow: "hidden", borderRadius: 6, background: "#0d1117",
        ...(fullscreen ? { padding: "8px" } : {}),
      }} />
    </div>
  );
}
