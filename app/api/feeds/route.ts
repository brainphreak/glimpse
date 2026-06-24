export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import db from "@/lib/db";

interface StoredWidget { type?: string; config?: { url?: string; title?: string; subreddit?: string } }

// List RSS feeds and subreddits already configured in RSS / Reddit widgets across all dashboard pages,
// so the Feed Digest can reuse them instead of re-entering a URL.
export async function GET() {
  const rows = db.prepare("SELECT widgets FROM dashboard_layout").all() as { widgets: string }[];
  const rss: { url: string; title: string }[] = [];
  const reddit: { subreddit: string }[] = [];

  for (const r of rows) {
    let widgets: StoredWidget[] = [];
    try { widgets = JSON.parse(r.widgets); } catch { continue; }
    for (const w of widgets) {
      if (w.type === "rss" && w.config?.url) rss.push({ url: w.config.url, title: w.config.title || w.config.url });
      if (w.type === "reddit" && w.config?.subreddit) reddit.push({ subreddit: w.config.subreddit });
    }
  }

  const uniqRss = Array.from(new Map(rss.map((x) => [x.url, x])).values());
  const uniqReddit = Array.from(new Map(reddit.map((x) => [x.subreddit, x])).values());
  return NextResponse.json({ rss: uniqRss, reddit: uniqReddit });
}
