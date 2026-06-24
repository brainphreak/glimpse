export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { title, url, icon, category, sort_order } = await req.json();
  db.prepare(
    "UPDATE links SET title = ?, url = ?, icon = ?, category = ?, sort_order = ? WHERE id = ?"
  ).run(title, url, icon, category, sort_order, id);
  const link = db.prepare("SELECT * FROM links WHERE id = ?").get(id);
  return NextResponse.json(link);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  db.prepare("DELETE FROM links WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
