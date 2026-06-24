export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET() {
  const layoutRow = db
    .prepare("SELECT widgets, layout FROM dashboard_layout WHERE id = 'default'")
    .get() as { widgets: string; layout: string } | undefined;

  // All dashboard pages (tabs), not just the default one.
  const pageRows = db
    .prepare("SELECT id, widgets, layout, name, sort_order FROM dashboard_layout ORDER BY sort_order, id")
    .all() as { id: string; widgets: string; layout: string; name: string; sort_order: number }[];

  const notes = db.prepare("SELECT * FROM notes ORDER BY id").all();
  const links = db.prepare("SELECT * FROM links ORDER BY sort_order, id").all();
  const servers = db.prepare("SELECT * FROM servers ORDER BY sort_order, id").all();

  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    // Kept for backward compatibility (default tab); `pages` carries all tabs.
    layout: layoutRow ? JSON.parse(layoutRow.layout) : [],
    widgets: layoutRow ? JSON.parse(layoutRow.widgets) : [],
    pages: pageRows.map((p) => ({
      id: p.id,
      name: p.name,
      sort_order: p.sort_order,
      widgets: JSON.parse(p.widgets || "[]"),
      layout: JSON.parse(p.layout || "[]"),
    })),
    notes,
    links,
    servers,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="dashboard-backup-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
