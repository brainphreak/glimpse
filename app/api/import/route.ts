export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function POST(req: Request) {
  const data = await req.json();

  if (!data || data.version !== 1) {
    return NextResponse.json({ error: "Invalid backup file" }, { status: 400 });
  }

  const restore = db.transaction(() => {
    // Layout — restore all tabs if the backup has `pages`; otherwise fall back to the
    // single default tab (older backups predate multi-page support).
    if (Array.isArray(data.pages) && data.pages.length > 0) {
      db.prepare("DELETE FROM dashboard_layout").run();
      const insertPage = db.prepare(
        "INSERT INTO dashboard_layout (id, widgets, layout, name, sort_order, updated_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)"
      );
      for (const p of data.pages) {
        insertPage.run(
          p.id ?? "default",
          JSON.stringify(p.widgets ?? []),
          JSON.stringify(p.layout ?? []),
          p.name ?? "",
          p.sort_order ?? 0
        );
      }
    } else if (data.widgets && data.layout) {
      db.prepare(
        "INSERT OR REPLACE INTO dashboard_layout (id, widgets, layout, updated_at) VALUES ('default', ?, ?, CURRENT_TIMESTAMP)"
      ).run(JSON.stringify(data.widgets), JSON.stringify(data.layout));
    }

    // Notes
    if (Array.isArray(data.notes) && data.notes.length > 0) {
      db.prepare("DELETE FROM notes").run();
      const insertNote = db.prepare(
        "INSERT INTO notes (id, title, content, color, updated_at) VALUES (?, ?, ?, ?, ?)"
      );
      for (const n of data.notes) {
        insertNote.run(n.id, n.title ?? "", n.content ?? "", n.color ?? "#1e293b", n.updated_at ?? new Date().toISOString());
      }
    }

    // Links
    if (Array.isArray(data.links) && data.links.length > 0) {
      db.prepare("DELETE FROM links").run();
      const insertLink = db.prepare(
        "INSERT INTO links (id, title, url, icon, category, sort_order) VALUES (?, ?, ?, ?, ?, ?)"
      );
      for (const l of data.links) {
        insertLink.run(l.id, l.title ?? "", l.url ?? "", l.icon ?? "", l.category ?? "General", l.sort_order ?? 0);
      }
    }

    // Servers
    if (Array.isArray(data.servers) && data.servers.length > 0) {
      db.prepare("DELETE FROM servers").run();
      const insertServer = db.prepare(
        "INSERT INTO servers (id, name, check_url, ssh_host, ssh_user, ssh_port, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)"
      );
      for (const s of data.servers) {
        insertServer.run(s.id, s.name ?? "", s.check_url ?? "", s.ssh_host ?? "", s.ssh_user ?? "root", s.ssh_port ?? 22, s.sort_order ?? 0);
      }
    }
  });

  restore();
  return NextResponse.json({ ok: true });
}
