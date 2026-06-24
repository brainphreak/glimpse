export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET() {
  const links = db.prepare("SELECT * FROM links ORDER BY category, sort_order, id").all();
  return NextResponse.json(links);
}

export async function POST(req: Request) {
  const { title, url, icon = "", category = "General", sort_order = 0 } = await req.json();
  const result = db
    .prepare("INSERT INTO links (title, url, icon, category, sort_order) VALUES (?, ?, ?, ?, ?)")
    .run(title, url, icon, category, sort_order);
  const link = db.prepare("SELECT * FROM links WHERE id = ?").get(result.lastInsertRowid);
  return NextResponse.json(link, { status: 201 });
}
