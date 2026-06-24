export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET() {
  const notes = db.prepare("SELECT * FROM notes ORDER BY sort_order ASC, id ASC").all();
  return NextResponse.json(notes);
}

export async function POST(req: Request) {
  const { title = "", content = "", color = "#1e293b" } = await req.json();
  const maxOrder = (db.prepare("SELECT MAX(sort_order) as m FROM notes").get() as { m: number | null }).m ?? -1;
  const result = db
    .prepare("INSERT INTO notes (title, content, color, sort_order) VALUES (?, ?, ?, ?)")
    .run(title, content, color, maxOrder + 1);
  const note = db.prepare("SELECT * FROM notes WHERE id = ?").get(result.lastInsertRowid);
  return NextResponse.json(note, { status: 201 });
}
