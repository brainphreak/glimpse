// Client-side AI helpers shared by the Claude / Briefing / Digest / AI-Terminal widgets.
//
// Two providers:
//   • Claude  — proxied through /api/claude/stream so the Anthropic key stays on the server.
//   • Ollama  — called DIRECTLY from the browser, because Ollama runs on the user's own
//               machine (not the server). The base URL is configurable in Settings and the
//               user must start Ollama with OLLAMA_ORIGINS allowing this site.
//
// This module is browser-only: it must not import any server-only code (db, config, etc.).

export const DEFAULT_OLLAMA_URL = "http://localhost:11434";

export interface ModelOption {
  id: string;          // value sent to the provider
  label: string;       // shown in the picker
  provider: "claude" | "claude-cli" | "ollama";
  vision?: boolean;    // accepts image input
}

// Default Claude line-up (paid API). Opus 4.8 is the default; Haiku is the cheap/fast option.
export const CLAUDE_MODELS: ModelOption[] = [
  { id: "claude-opus-4-8", label: "Claude Opus 4.8", provider: "claude", vision: true },
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", provider: "claude", vision: true },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", provider: "claude", vision: true },
];

// Claude via the server's `claude` CLI — uses the subscription, no API billing.
export const CLI_MODELS: ModelOption[] = [
  { id: "claude-cli", label: "Claude · subscription (CLI)", provider: "claude-cli" },
  { id: "claude-cli-sonnet", label: "Claude Sonnet · subscription", provider: "claude-cli" },
  { id: "claude-cli-opus", label: "Claude Opus · subscription", provider: "claude-cli" },
];

export const DEFAULT_CLAUDE_MODEL = "claude-opus-4-8";

export interface Attachment {
  dataUrl: string;     // "data:image/png;base64,...."
  mediaType: string;   // "image/png"
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  images?: Attachment[];
}

// What the dashboard knows about AI providers, read from /api/config + the CLI probe.
export interface AIConfig {
  hasAnthropic: boolean;       // paid API key configured
  hasClaudeCli: boolean;       // `claude` CLI available on the server (uses subscription)
  claudeCliLoggedIn: boolean;  // CLI is authenticated (has run /login)
  ollamaUrl: string;
}

export async function getAIConfig(): Promise<AIConfig> {
  try {
    const [cfg, cli] = await Promise.all([
      fetch("/api/config").then((r) => r.json()),
      fetch("/api/claude/cli").then((r) => r.json()).catch(() => ({ available: false, loggedIn: false })),
    ]);
    const url = typeof cfg.ollama_url === "string" && cfg.ollama_url.trim() ? cfg.ollama_url.trim() : DEFAULT_OLLAMA_URL;
    return { hasAnthropic: !!cfg.anthropic_api_key, hasClaudeCli: !!cli.available, claudeCliLoggedIn: !!cli.loggedIn, ollamaUrl: url.replace(/\/+$/, "") };
  } catch {
    return { hasAnthropic: false, hasClaudeCli: false, claudeCliLoggedIn: false, ollamaUrl: DEFAULT_OLLAMA_URL };
  }
}

// Status of the browser→Ollama probe, so widgets can explain why Ollama models are missing.
export interface OllamaStatus { url: string; ok: boolean; count: number; reason?: string }

// Combined model discovery used by every AI widget: paid Claude + subscription CLI + local Ollama.
export async function discoverModels(): Promise<{ models: ModelOption[]; ollamaUrl: string; ollama: OllamaStatus; claudeCliLoggedIn: boolean }> {
  const cfg = await getAIConfig();
  const url = cfg.ollamaUrl.replace(/\/+$/, "");
  let ollamaModels: ModelOption[] = [];
  let ollama: OllamaStatus = { url, ok: false, count: 0 };

  // On an HTTPS page, a plain-http Ollama can never be reached (mixed content). That's the
  // external server, where Ollama is intentionally not used — skip quietly (no group, no warning).
  if (typeof window !== "undefined" && window.location.protocol === "https:" && url.startsWith("http:")) {
    const models = [
      ...(cfg.hasAnthropic ? CLAUDE_MODELS : []),
      ...(cfg.hasClaudeCli ? CLI_MODELS : []),
    ];
    return { models, ollamaUrl: url, ollama, claudeCliLoggedIn: cfg.claudeCliLoggedIn };
  }

  try {
    const res = await fetch(`${url}/api/tags`);
    if (!res.ok) {
      ollama = { url, ok: false, count: 0, reason: `Ollama returned HTTP ${res.status}` };
    } else {
      const data = await res.json();
      const models: { name: string }[] = data.models || [];
      ollamaModels = models.map((m) => ({
        id: m.name,
        label: m.name,
        provider: "ollama" as const,
        vision: /llava|vision|llama3\.2-vision|moondream|bakllava|minicpm-v|qwen.*v|gemma.*vision/i.test(m.name),
      }));
      ollama = { url, ok: true, count: ollamaModels.length };
    }
  } catch {
    // fetch() throws an opaque TypeError for CORS/mixed-content/offline — infer the most likely cause.
    const mixed = typeof window !== "undefined" && window.location.protocol === "https:" && url.startsWith("http:");
    ollama = {
      url, ok: false, count: 0,
      reason: mixed
        ? "Blocked: this page is HTTPS but Ollama is http:// (mixed content). Open the dashboard over http:// to use Ollama."
        : "Can't reach Ollama from your browser. Start it with OLLAMA_ORIGINS=\"*\" (CORS) and reload.",
    };
  }
  const models = [
    ...(cfg.hasAnthropic ? CLAUDE_MODELS : []),
    ...(cfg.hasClaudeCli ? CLI_MODELS : []),
    ...ollamaModels,
  ];
  return { models, ollamaUrl: url, ollama, claudeCliLoggedIn: cfg.claudeCliLoggedIn };
}

// List models installed in the user's local Ollama. Returns [] if unreachable.
export async function listOllamaModels(ollamaUrl: string): Promise<ModelOption[]> {
  try {
    const res = await fetch(`${ollamaUrl.replace(/\/+$/, "")}/api/tags`);
    if (!res.ok) return [];
    const data = await res.json();
    const models: { name: string }[] = data.models || [];
    return models.map((m) => ({
      id: m.name,
      label: m.name,
      provider: "ollama" as const,
      // crude vision heuristic — llava / vision / -v models accept images
      vision: /llava|vision|llama3\.2-vision|moondream|bakllava|minicpm-v|qwen.*v|gemma.*vision/i.test(m.name),
    }));
  } catch {
    return [];
  }
}

const b64 = (dataUrl: string) => dataUrl.slice(dataUrl.indexOf(",") + 1);

// Read an NDJSON (newline-delimited JSON) stream and hand each parsed object to onObj.
async function readNdjson(
  res: Response,
  onObj: (obj: Record<string, unknown>) => void,
  signal?: AbortSignal
): Promise<void> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    if (signal?.aborted) { reader.cancel().catch(() => {}); return; }
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      try { onObj(JSON.parse(line)); } catch { /* ignore partial / non-JSON */ }
    }
  }
  const tail = buf.trim();
  if (tail) { try { onObj(JSON.parse(tail)); } catch {} }
}

export interface StreamOpts {
  model: string;
  messages: ChatMessage[];
  system?: string;
  webSearch?: boolean;       // Claude only
  ollamaUrl?: string;        // Ollama only
  signal?: AbortSignal;
}

// Stream a chat completion from Ollama, directly from the browser.
async function streamOllama(opts: StreamOpts, onToken: (t: string) => void): Promise<void> {
  const url = (opts.ollamaUrl || DEFAULT_OLLAMA_URL).replace(/\/+$/, "");
  const messages = [
    ...(opts.system ? [{ role: "system", content: opts.system }] : []),
    ...opts.messages.map((m) => ({
      role: m.role,
      content: m.content,
      ...(m.images?.length ? { images: m.images.map((im) => b64(im.dataUrl)) } : {}),
    })),
  ];
  const res = await fetch(`${url}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: opts.model, messages, stream: true }),
    signal: opts.signal,
  });
  if (!res.ok || !res.body) {
    throw new Error(`Ollama ${res.status}: ${(await res.text().catch(() => "")) || "request failed"}`);
  }
  await readNdjson(res, (obj) => {
    const msg = obj.message as { content?: string } | undefined;
    if (msg?.content) onToken(msg.content);
    if (obj.error) throw new Error(String(obj.error));
  }, opts.signal);
}

// Stream a chat completion from Claude via the server proxy (keeps the API key server-side).
async function streamClaude(opts: StreamOpts, onToken: (t: string) => void): Promise<void> {
  const res = await fetch("/api/claude/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: opts.model,
      system: opts.system,
      webSearch: opts.webSearch,
      messages: opts.messages,
    }),
    signal: opts.signal,
  });
  if (!res.ok || !res.body) {
    let msg = `Claude ${res.status}`;
    try { const j = await res.json(); if (j.error) msg = j.error; } catch {}
    throw new Error(msg);
  }
  await readNdjson(res, (obj) => {
    if (obj.t === "text") onToken(String(obj.v ?? ""));
    else if (obj.t === "error") throw new Error(String(obj.v ?? "stream error"));
  }, opts.signal);
}

// Stream a chat completion from the server's `claude` CLI (subscription, no API key).
async function streamClaudeCli(opts: StreamOpts, onToken: (t: string) => void): Promise<void> {
  const res = await fetch("/api/claude/cli", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: opts.model, system: opts.system, messages: opts.messages }),
    signal: opts.signal,
  });
  if (!res.ok || !res.body) {
    let msg = `Claude CLI ${res.status}`;
    try { const j = await res.json(); if (j.error) msg = j.error; } catch {}
    throw new Error(msg);
  }
  await readNdjson(res, (obj) => {
    if (obj.t === "text") onToken(String(obj.v ?? ""));
    else if (obj.t === "error") throw new Error(String(obj.v ?? "stream error"));
  }, opts.signal);
}

// Unified entry point. Routes by provider (preferred) or by Claude model id.
export async function streamChat(
  opts: StreamOpts & { provider?: "claude" | "claude-cli" | "ollama" },
  onToken: (t: string) => void
): Promise<void> {
  if (opts.provider === "claude-cli" || opts.model.startsWith("claude-cli")) return streamClaudeCli(opts, onToken);
  const isClaude = opts.provider === "claude" || CLAUDE_MODELS.some((m) => m.id === opts.model);
  if (isClaude) return streamClaude(opts, onToken);
  return streamOllama(opts, onToken);
}

// Convenience: collect a full (non-incremental) completion. Used by Briefing / Digest.
export async function complete(
  opts: StreamOpts & { provider?: "claude" | "claude-cli" | "ollama" }
): Promise<string> {
  let out = "";
  await streamChat(opts, (t) => { out += t; });
  return out;
}
