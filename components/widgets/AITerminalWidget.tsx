"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useWidgetSettings } from "@/components/WidgetWrapper";
import {
  discoverModels, DEFAULT_CLAUDE_MODEL,
  streamChat, type ChatMessage, type ModelOption,
} from "@/lib/ai";

interface Line { kind: "prompt" | "response" | "system"; text: string }
interface AITermConfig { model?: string }

export default function AITerminalWidget({ config, onConfigChange }: { config: AITermConfig; onConfigChange?: (c: Record<string, unknown>) => void }) {
  const [lines, setLines] = useState<Line[]>([{ kind: "system", text: "AI terminal ready. Type a message and press Enter. Commands: /clear, /model" }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [model, setModel] = useState(config.model || DEFAULT_CLAUDE_MODEL);
  const convo = useRef<ChatMessage[]>([]);
  const ollamaUrl = useRef("");
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView(); }, [lines]);

  useEffect(() => {
    (async () => {
      const { models: all, ollamaUrl: url, ollama, claudeCliLoggedIn } = await discoverModels();
      ollamaUrl.current = url;
      setModels(all);
      if (all.length && !all.some((m) => m.id === (config.model || model))) setModel(all[0].id);
      setLines((l) => [...l, { kind: "system", text: all.length ? `Model: ${all.find((m) => m.id === (config.model || model))?.label || all[0].label}` : "No AI provider configured (Settings → Setup)." }]);
      if (!ollama.ok) setLines((l) => [...l, { kind: "system", text: `Ollama (${ollama.url}): ${ollama.reason}` }]);
      if (all.some((m) => m.provider === "claude-cli") && !claudeCliLoggedIn) setLines((l) => [...l, { kind: "system", text: "Claude subscription not logged in — add a Terminal widget, run claude, then /login." }]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = useCallback(async (raw: string) => {
    const text = raw.trim();
    if (!text || busy) return;
    if (text === "/clear") { setLines([]); convo.current = []; return; }
    if (text === "/model") { setLines((l) => [...l, { kind: "prompt", text }, { kind: "system", text: `Available: ${models.map((m) => m.id).join(", ") || "(none)"} — change in the gear menu.` }]); return; }

    setLines((l) => [...l, { kind: "prompt", text }, { kind: "response", text: "" }]);
    convo.current = [...convo.current, { role: "user", content: text }];
    setBusy(true);
    const append = (t: string) => setLines((l) => {
      const copy = [...l];
      for (let i = copy.length - 1; i >= 0; i--) { if (copy[i].kind === "response") { copy[i] = { ...copy[i], text: copy[i].text + t }; break; } }
      return copy;
    });
    let acc = "";
    try {
      await streamChat(
        { model, provider: models.find((m) => m.id === model)?.provider, ollamaUrl: ollamaUrl.current, messages: convo.current },
        (t) => { acc += t; append(t); }
      );
      convo.current = [...convo.current, { role: "assistant", content: acc }];
    } catch (e) {
      append(`\n[error] ${String(e instanceof Error ? e.message : e)}`);
    } finally {
      setBusy(false);
    }
  }, [busy, model, models]);

  useWidgetSettings(
    <div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Model</div>
      <select value={model} onChange={(e) => { setModel(e.target.value); onConfigChange?.({ model: e.target.value }); }} style={{ width: "100%", fontSize: 12, padding: "5px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-base)", color: "var(--text-primary)", outline: "none" }}>
        {models.length === 0 && <option>No models — configure AI in Setup</option>}
        {models.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
      </select>
    </div>
  );

  return (
    <div
      onClick={() => inputRef.current?.focus()}
      style={{ display: "flex", flexDirection: "column", height: "100%", background: "#0a0a0a", borderRadius: 8, padding: 10, fontFamily: "var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)", fontSize: 12.5, lineHeight: 1.5, overflow: "hidden", cursor: "text" }}
    >
      <div style={{ flex: 1, overflow: "auto" }}>
        {lines.map((l, i) => (
          <div key={i} style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", color: l.kind === "prompt" ? "#7ee787" : l.kind === "system" ? "#6e7681" : "#e6edf3" }}>
            {l.kind === "prompt" ? <span style={{ color: "#58a6ff" }}>❯ </span> : null}
            {l.text}
            {l.kind === "response" && busy && i === lines.length - 1 ? <span style={{ color: "#7ee787" }}>▋</span> : null}
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, borderTop: "1px solid #21262d", paddingTop: 6, marginTop: 6 }}>
        <span style={{ color: "#58a6ff" }}>❯</span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { const v = input; setInput(""); run(v); } }}
          disabled={busy}
          placeholder={busy ? "…thinking" : "type a message"}
          style={{ flex: 1, background: "transparent", border: "none", color: "#e6edf3", fontFamily: "inherit", fontSize: "inherit", outline: "none" }}
        />
      </div>
    </div>
  );
}
