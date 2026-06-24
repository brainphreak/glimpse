export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getConfig } from "@/lib/config";

const ALLOWED_MODELS = new Set(["claude-opus-4-8", "claude-sonnet-4-6", "claude-haiku-4-5"]);
const DEFAULT_MODEL = "claude-opus-4-8";

interface InAttachment { dataUrl: string; mediaType: string }
interface InMessage { role: "user" | "assistant"; content: string; images?: InAttachment[] }

// Convert our widget message shape into Anthropic content blocks (text + base64 images).
function toAnthropic(messages: InMessage[]) {
  return messages.map((m) => {
    if (!m.images?.length) return { role: m.role, content: m.content };
    const blocks: unknown[] = m.images.map((im) => ({
      type: "image",
      source: { type: "base64", media_type: im.mediaType, data: im.dataUrl.slice(im.dataUrl.indexOf(",") + 1) },
    }));
    if (m.content) blocks.push({ type: "text", text: m.content });
    return { role: m.role, content: blocks };
  });
}

export async function POST(req: Request) {
  const apiKey = getConfig("anthropic_api_key");
  if (!apiKey) {
    return NextResponse.json({ error: "Anthropic API key not configured. Add it in Settings → Setup." }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const model = ALLOWED_MODELS.has(body.model) ? body.model : DEFAULT_MODEL;
  const messages: InMessage[] = Array.isArray(body.messages) ? body.messages : [];
  const system: string | undefined = typeof body.system === "string" ? body.system : undefined;

  // Web search tool — newer dynamic-filtering variant for opus/sonnet, basic for haiku.
  const tools = body.webSearch
    ? [{ type: model === "claude-haiku-4-5" ? "web_search_20250305" : "web_search_20260209", name: "web_search" }]
    : undefined;

  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      stream: true,
      ...(system ? { system } : {}),
      ...(tools ? { tools } : {}),
      messages: toAnthropic(messages),
    }),
  });

  if (!upstream.ok || !upstream.body) {
    let msg = `Anthropic error (${upstream.status})`;
    try { const j = await upstream.json(); msg = j.error?.message || msg; } catch {}
    return NextResponse.json({ error: msg }, { status: upstream.status || 500 });
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const send = (obj: unknown) => encoder.encode(JSON.stringify(obj) + "\n");

  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body!.getReader();
      let buf = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          // Anthropic emits SSE: blank-line-separated events with `data:` payloads.
          let nl: number;
          while ((nl = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;
            let evt: Record<string, unknown>;
            try { evt = JSON.parse(payload); } catch { continue; }
            if (evt.type === "content_block_delta") {
              const delta = evt.delta as { type?: string; text?: string };
              if (delta?.type === "text_delta" && delta.text) {
                controller.enqueue(send({ t: "text", v: delta.text }));
              }
            } else if (evt.type === "error") {
              const e = evt.error as { message?: string } | undefined;
              controller.enqueue(send({ t: "error", v: e?.message || "stream error" }));
            }
          }
        }
        controller.enqueue(send({ t: "done" }));
      } catch (e) {
        controller.enqueue(send({ t: "error", v: String(e) }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Content-Type-Options": "nosniff",
      "X-Accel-Buffering": "no", // prevent nginx from buffering the stream
    },
  });
}
