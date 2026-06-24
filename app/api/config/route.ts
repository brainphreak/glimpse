export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getAllConfig, setConfig, SECRET_KEYS } from "@/lib/config";

export async function GET() {
  const all = getAllConfig();
  // Mask secret values — return true/false for whether they're set
  const masked: Record<string, string | boolean> = {};
  for (const [k, v] of Object.entries(all)) {
    masked[k] = SECRET_KEYS.has(k) ? (v ? true : false) : v;
  }
  return NextResponse.json(masked);
}

export async function PUT(req: Request) {
  const body = await req.json() as Record<string, string>;
  for (const [key, value] of Object.entries(body)) {
    if (typeof value === "string") {
      setConfig(key, value);
    }
  }
  return NextResponse.json({ ok: true });
}
