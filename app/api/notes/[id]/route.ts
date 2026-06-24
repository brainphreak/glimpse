export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { title, content, color, sort_order } = await req.json();
  if (sort_order !== undefined) {
    db.prepare(
      "UPDATE notes SET title = ?, content = ?, color = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).run(title, content, color, sort_order, id);
  } else {
    db.prepare(
      "UPDATE notes SET title = ?, content = ?, color = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).run(title, content, color, id);
  }
  const note = db.prepare("SELECT * FROM notes WHERE id = ?").get(id);
  return NextResponse.json(note);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  db.prepare("DELETE FROM notes WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
