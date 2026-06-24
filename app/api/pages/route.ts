export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import db from "@/lib/db";

interface PageRow { id: string; name: string; sort_order: number }

export async function GET() {
  const rows = db.prepare("SELECT id, name, sort_order FROM dashboard_layout ORDER BY sort_order ASC, rowid ASC").all() as PageRow[];
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const { name } = await req.json().catch(() => ({}));
  const id = `page-${Date.now()}`;
  const { m } = db.prepare("SELECT COALESCE(MAX(sort_order), -1) AS m FROM dashboard_layout").get() as { m: number };
  const pageName = (name && String(name).trim()) || "New Tab";
  db.prepare("INSERT INTO dashboard_layout (id, name, widgets, layout, sort_order) VALUES (?, ?, '[]', '[]', ?)").run(id, pageName, m + 1);
  return NextResponse.json({ id, name: pageName, sort_order: m + 1 });
}

export async function PATCH(req: Request) {
  const { id, name, sort_order } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  if (typeof name === "string") db.prepare("UPDATE dashboard_layout SET name = ? WHERE id = ?").run(name, id);
  if (typeof sort_order === "number") db.prepare("UPDATE dashboard_layout SET sort_order = ? WHERE id = ?").run(sort_order, id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { c } = db.prepare("SELECT COUNT(*) AS c FROM dashboard_layout").get() as { c: number };
  if (c <= 1) return NextResponse.json({ error: "Cannot delete the last page" }, { status: 400 });
  db.prepare("DELETE FROM dashboard_layout WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
