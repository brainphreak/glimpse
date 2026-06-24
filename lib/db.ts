import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;

  const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), "dashboard.db");
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");

  db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      color TEXT DEFAULT '#1e293b',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      icon TEXT DEFAULT '',
      category TEXT DEFAULT 'General',
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS servers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      check_url TEXT NOT NULL,
      ssh_host TEXT DEFAULT '',
      ssh_user TEXT DEFAULT 'root',
      ssh_port INTEGER DEFAULT 22,
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS dashboard_layout (
      id TEXT PRIMARY KEY,
      widgets TEXT NOT NULL DEFAULT '[]',
      layout TEXT NOT NULL DEFAULT '[]',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS widget_configs (
      widget_id TEXT PRIMARY KEY,
      config TEXT NOT NULL DEFAULT '{}'
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS config (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    );
  `);

  // Add sort_order to notes if this is an existing DB without it
  try { db.exec("ALTER TABLE notes ADD COLUMN sort_order INTEGER DEFAULT 0"); } catch {}

  // Multi-page (tabbed) dashboards: each row in dashboard_layout is a page
  try { db.exec("ALTER TABLE dashboard_layout ADD COLUMN name TEXT DEFAULT ''"); } catch {}
  try { db.exec("ALTER TABLE dashboard_layout ADD COLUMN sort_order INTEGER DEFAULT 0"); } catch {}
  try { db.prepare("UPDATE dashboard_layout SET name = 'Dashboard' WHERE id = 'default' AND (name IS NULL OR name = '')").run(); } catch {}

  const hasDefault = db.prepare("SELECT id FROM dashboard_layout WHERE id = 'default'").get();
  if (!hasDefault) {
    const defaultWidgets = JSON.stringify([
      { id: "clock-1",          type: "clock",          config: {} },
      { id: "weather-1",        type: "weather",        config: { city: process.env.WEATHER_CITY || "New York" } },
      { id: "calendar-1",       type: "calendar",       config: {} },
      { id: "server-monitor-1", type: "server-monitor", config: {} },
      { id: "notes-1",          type: "notes",          config: {} },
      { id: "links-1",          type: "links",          config: {} },
      { id: "claude-1",         type: "claude",         config: {} },
    ]);
    const defaultLayout = JSON.stringify([
      { i: "clock-1",          x: 0,  y: 0,  w: 3, h: 3, minW: 2, minH: 2 },
      { i: "weather-1",        x: 3,  y: 0,  w: 3, h: 3, minW: 2, minH: 2 },
      { i: "calendar-1",       x: 6,  y: 0,  w: 6, h: 8, minW: 4, minH: 6 },
      { i: "server-monitor-1", x: 0,  y: 3,  w: 6, h: 5, minW: 3, minH: 3 },
      { i: "notes-1",          x: 0,  y: 8,  w: 6, h: 6, minW: 3, minH: 4 },
      { i: "links-1",          x: 6,  y: 8,  w: 6, h: 6, minW: 3, minH: 3 },
      { i: "claude-1",         x: 0,  y: 14, w: 12,h: 8, minW: 6, minH: 6 },
    ]);
    db.prepare("INSERT INTO dashboard_layout (id, widgets, layout) VALUES ('default', ?, ?)").run(defaultWidgets, defaultLayout);
  }

  _db = db;
  return db;
}

export default new Proxy({} as Database.Database, {
  get(_, prop) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = getDb() as any;
    const val = db[prop];
    return typeof val === "function" ? val.bind(db) : val;
  },
});
