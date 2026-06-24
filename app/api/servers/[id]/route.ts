export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { name, check_url, ssh_host, ssh_user, ssh_port, sort_order } = await req.json();
  db.prepare(
    "UPDATE servers SET name = ?, check_url = ?, ssh_host = ?, ssh_user = ?, ssh_port = ?, sort_order = ? WHERE id = ?"
  ).run(name, check_url, ssh_host, ssh_user, ssh_port, sort_order, id);
  const server = db.prepare("SELECT * FROM servers WHERE id = ?").get(id);
  return NextResponse.json(server);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  db.prepare("DELETE FROM servers WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
