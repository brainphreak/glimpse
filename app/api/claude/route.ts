export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getConfig } from "@/lib/config";

export async function POST(req: Request) {
  const apiKey = getConfig("anthropic_api_key");
  if (!apiKey) {
    return NextResponse.json({ error: "Anthropic API key not configured. Add it in Settings → Setup." }, { status: 503 });
  }

  const { messages } = await req.json();

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        messages,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || "Anthropic error");
    return NextResponse.json({ content: data.content?.[0]?.text || "" });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
