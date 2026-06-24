export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET() {
  const servers = db.prepare("SELECT * FROM servers ORDER BY sort_order, id").all();

  const results = await Promise.all(
    (servers as Array<{ id: number; name: string; check_url: string; ssh_host: string; ssh_user: string; ssh_port: number; sort_order: number }>).map(async (server) => {
      const start = Date.now();
      try {
        const res = await fetch(server.check_url, {
          signal: AbortSignal.timeout(5000),
          cache: "no-store",
        });
        return { ...server, online: res.ok, latency: Date.now() - start };
      } catch {
        return { ...server, online: false, latency: null };
      }
    })
  );

  return NextResponse.json(results);
}

export async function POST(req: Request) {
  const { name, check_url, ssh_host = "", ssh_user = "root", ssh_port = 22, sort_order = 0 } =
    await req.json();
  const result = db
    .prepare(
      "INSERT INTO servers (name, check_url, ssh_host, ssh_user, ssh_port, sort_order) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run(name, check_url, ssh_host, ssh_user, ssh_port, sort_order);
  const server = db.prepare("SELECT * FROM servers WHERE id = ?").get(result.lastInsertRowid);
  return NextResponse.json(server, { status: 201 });
}
