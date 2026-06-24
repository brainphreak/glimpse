export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getConfig, setConfig } from "@/lib/config";

export async function GET() {
  const raw = getConfig("dashboard_settings");
  let settings = null;
  try { settings = raw ? JSON.parse(raw) : null; } catch {}
  return NextResponse.json({ settings });
}

export async function PUT(req: Request) {
  const body = await req.json();
  setConfig("dashboard_settings", JSON.stringify(body));
  return NextResponse.json({ ok: true });
}
