"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Terminal, ExternalLink, RotateCcw, Globe, ImagePlus, Square, X } from "lucide-react";
import {
  discoverModels, DEFAULT_CLAUDE_MODEL,
  streamChat, type ChatMessage, type Attachment, type ModelOption, type OllamaStatus,
} from "@/lib/ai";

interface ClaudeConfig { model?: string; webSearch?: boolean }

export default function ClaudeWidget({ config, onConfigChange }: { config?: ClaudeConfig; onConfigChange?: (c: Record<string, unknown>) => void } = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [model, setModel] = useState(config?.model || DEFAULT_CLAUDE_MODEL);
  const [webSearch, setWebSearch] = useState(!!config?.webSearch);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [ollamaUrl, setOllamaUrl] = useState("");
  const [ollama, setOllama] = useState<OllamaStatus | null>(null);
  const [cliLoggedIn, setCliLoggedIn] = useState(true); // assume ok until discovery says otherwise
  const [ready, setReady] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Discover models: paid Claude (if key set) + subscription CLI + local Ollama.
  useEffect(() => {
    (async () => {
      const { models: all, ollamaUrl: url, ollama: ol, claudeCliLoggedIn } = await discoverModels();
      setOllamaUrl(url);
      setOllama(ol);
      setCliLoggedIn(claudeCliLoggedIn);
      setModels(all);
      // Keep saved model if still available; else default to first.
      if (all.length && !all.some((m) => m.id === (config?.model || model))) {
        setModel(all[0].id);
      }
      setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = models.find((m) => m.id === model);
  const isClaude = selected?.provider === "claude";
  const needsCliLogin = selected?.provider === "claude-cli" && !cliLoggedIn;
  const canVision = !!selected?.vision;

  const patchConfig = useCallback((patch: ClaudeConfig) => {
    onConfigChange?.({ model, webSearch, ...patch });
  }, [onConfigChange, model, webSearch]);

  const addImages = async (files: FileList | null) => {
    if (!files) return;
    const next: Attachment[] = [];
    for (const f of Array.from(files)) {
      if (!f.type.startsWith("image/")) continue;
      const dataUrl = await new Promise<string>((res) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result));
        r.readAsDataURL(f);
      });
      next.push({ dataUrl, mediaType: f.type });
    }
    setAttachments((a) => [...a, ...next]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const stop = () => { abortRef.current?.abort(); setStreaming(false); };

  const send = async () => {
    const text = input.trim();
    if ((!text && !attachments.length) || streaming) return;
    const userMsg: ChatMessage = { role: "user", content: text, ...(attachments.length ? { images: attachments } : {}) };
    const convo = [...messages, userMsg];
    setMessages([...convo, { role: "assistant", content: "" }]);
    setInput("");
    setAttachments([]);
    setStreaming(true);

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const append = (t: string) =>
      setMessages((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last?.role === "assistant") copy[copy.length - 1] = { ...last, content: last.content + t };
        return copy;
      });

    try {
      await streamChat(
        { model, provider: selected?.provider, messages: convo, webSearch: isClaude && webSearch, ollamaUrl, signal: ctrl.signal },
        append
      );
    } catch (e) {
      if (!ctrl.signal.aborted) {
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last?.role === "assistant" && !last.content) copy[copy.length - 1] = { ...last, content: `⚠️ ${String(e instanceof Error ? e.message : e)}` };
          return copy;
        });
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const noProviders = ready && models.length === 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 0 }}>
      {/* Toolbar: launchers + model picker + controls */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
        <a href="https://claude.ai/new" target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "rgba(188,140,255,0.1)", color: "var(--purple)", textDecoration: "none" }}>
          <ExternalLink size={11} /> Claude.ai
        </a>
        {models.length > 0 && (
          <select
            value={model}
            onChange={(e) => { setModel(e.target.value); patchConfig({ model: e.target.value }); }}
            style={{ fontSize: 11, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-base)", color: "var(--text-primary)", outline: "none", maxWidth: 170 }}
          >
            {models.some((m) => m.provider === "claude") && (
              <optgroup label="Claude (API)">
                {models.filter((m) => m.provider === "claude").map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </optgroup>
            )}
            {models.some((m) => m.provider === "claude-cli") && (
              <optgroup label="Claude (subscription)">
                {models.filter((m) => m.provider === "claude-cli").map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </optgroup>
            )}
            {models.some((m) => m.provider === "ollama") && (
              <optgroup label="Ollama (local)">
                {models.filter((m) => m.provider === "ollama").map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </optgroup>
            )}
          </select>
        )}
        {isClaude && (
          <button
            onClick={() => { const v = !webSearch; setWebSearch(v); patchConfig({ webSearch: v }); }}
            title="Toggle web search"
            style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)", cursor: "pointer", background: webSearch ? "var(--accent)" : "transparent", color: webSearch ? "#fff" : "var(--text-muted)" }}
          >
            <Globe size={11} /> Web
          </button>
        )}
        {messages.length > 0 && (
          <button onClick={() => setMessages([])} title="Clear chat" style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", marginLeft: "auto" }}>
            <RotateCcw size={11} /> Clear
          </button>
        )}
      </div>

      {ollama && !ollama.ok && (
        <div style={{ fontSize: 10, color: "var(--warning)", marginBottom: 8, lineHeight: 1.4 }}>
          Ollama ({ollama.url}): {ollama.reason}
        </div>
      )}

      {needsCliLogin && (
        <div style={{ fontSize: 10, color: "var(--warning)", marginBottom: 8, lineHeight: 1.4 }}>
          Claude subscription isn&apos;t logged in. Add a <b>Terminal</b> widget, run <code>claude</code>, then <code>/login</code>, and reload.
        </div>
      )}

      {noProviders && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, color: "var(--text-muted)", textAlign: "center" }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(188,140,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Terminal size={20} color="var(--purple)" />
          </div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>No AI provider available</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", maxWidth: 280 }}>
            Add an <b>Anthropic API key</b> in Settings → Setup for Claude, or run <b>Ollama</b> locally and set its URL there.
          </div>
        </div>
      )}

      {!noProviders && (
        <>
          <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: 10, marginBottom: 10 }}>
            {messages.length === 0 && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 6, color: "var(--text-muted)" }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(188,140,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Terminal size={18} color="var(--purple)" />
                </div>
                <span style={{ fontSize: 12 }}>{isClaude ? "Ask Claude anything" : `Chat with ${model}`}</span>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{
                  maxWidth: "88%", padding: "8px 12px", borderRadius: 12, fontSize: 13, lineHeight: 1.5,
                  background: msg.role === "user" ? "var(--accent)" : "rgba(255,255,255,0.05)",
                  color: msg.role === "user" ? "#fff" : "var(--text-primary)",
                  borderBottomRightRadius: msg.role === "user" ? 4 : 12,
                  borderBottomLeftRadius: msg.role === "user" ? 12 : 4,
                  whiteSpace: "pre-wrap", wordBreak: "break-word",
                }}>
                  {msg.images?.length ? (
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: msg.content ? 6 : 0 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {msg.images.map((im, k) => <img key={k} src={im.dataUrl} alt="" style={{ maxWidth: 120, maxHeight: 120, borderRadius: 6 }} />)}
                    </div>
                  ) : null}
                  {msg.content || (msg.role === "assistant" && streaming && i === messages.length - 1 ? (
                    <span style={{ display: "inline-flex", gap: 4 }}>
                      {[0, 1, 2].map((d) => <span key={d} style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--purple)", animation: `pulse-dot 1.2s ease-in-out ${d * 0.2}s infinite` }} />)}
                    </span>
                  ) : "")}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Pending image attachments */}
          {attachments.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
              {attachments.map((a, i) => (
                <div key={i} style={{ position: "relative" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.dataUrl} alt="" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 6, border: "1px solid var(--border)" }} />
                  <button onClick={() => setAttachments((arr) => arr.filter((_, k) => k !== i))} style={{ position: "absolute", top: -6, right: -6, width: 16, height: 16, borderRadius: "50%", border: "none", background: "var(--danger)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, borderTop: "1px solid var(--border)", paddingTop: 10, alignItems: "center" }}>
            {canVision && (
              <>
                <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => addImages(e.target.files)} />
                <button onClick={() => fileRef.current?.click()} title="Attach image" style={{ display: "flex", padding: "8px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer" }}>
                  <ImagePlus size={14} />
                </button>
              </>
            )}
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={`Message ${selected?.label || "AI"}… (Enter to send)`}
              style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none" }}
            />
            {streaming ? (
              <button onClick={stop} title="Stop" style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "var(--danger)", color: "#fff", cursor: "pointer" }}>
                <Square size={14} />
              </button>
            ) : (
              <button onClick={send} disabled={!input.trim() && !attachments.length} style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "var(--purple)", color: "#fff", cursor: "pointer", opacity: (!input.trim() && !attachments.length) ? 0.5 : 1 }}>
                <Send size={14} />
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
