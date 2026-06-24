export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") || "default";
  const row = db.prepare("SELECT * FROM dashboard_layout WHERE id = ?").get(id) as
    | { widgets: string; layout: string }
    | undefined;
  if (!row) return NextResponse.json({ widgets: [], layout: [] });
  return NextResponse.json({
    widgets: JSON.parse(row.widgets),
    layout: JSON.parse(row.layout),
  });
}

export async function POST(req: Request) {
  const { id = "default", widgets, layout } = await req.json();
  // UPSERT that preserves name/sort_order (INSERT OR REPLACE would reset them)
  db.prepare(
    `INSERT INTO dashboard_layout (id, widgets, layout) VALUES (?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET widgets = excluded.widgets, layout = excluded.layout, updated_at = CURRENT_TIMESTAMP`
  ).run(id, JSON.stringify(widgets), JSON.stringify(layout));
  return NextResponse.json({ ok: true });
}
