export const dynamic = "force-dynamic";
import { auth } from "@/lib/auth";
import db from "@/lib/db";
import { getConfig } from "@/lib/config";
import Dashboard from "@/components/Dashboard";
import type { DashboardSettings } from "@/components/SettingsModal";

interface PageRow { id: string; name: string; sort_order: number }

export default async function Home() {
  const session = await auth();

  let initialSettings: DashboardSettings | null = null;
  try {
    const raw = getConfig("dashboard_settings");
    initialSettings = raw ? JSON.parse(raw) : null;
  } catch {}

  let pages = db.prepare("SELECT id, name, sort_order FROM dashboard_layout ORDER BY sort_order ASC, rowid ASC").all() as PageRow[];
  if (pages.length === 0) pages = [{ id: "default", name: "Dashboard", sort_order: 0 }];

  const activeId = pages[0].id;
  const row = db.prepare("SELECT * FROM dashboard_layout WHERE id = ?").get(activeId) as
    | { widgets: string; layout: string }
    | undefined;

  const widgets = row ? JSON.parse(row.widgets) : [];
  const layout = row ? JSON.parse(row.layout) : [];

  return (
    <Dashboard
      initialPages={pages}
      initialPageId={activeId}
      initialWidgets={widgets}
      initialLayout={layout}
      initialSettings={initialSettings}
      loggedIn={!!session?.user}
      userEmail={session?.user?.email}
    />
  );
}
