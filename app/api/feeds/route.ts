export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import db from "@/lib/db";

interface StoredWidget {
  type?: string;
  config?: { url?: string; title?: string; subreddit?: string; feeds?: string[] };
}

function hostOf(url: string) { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; } }

// Discover feeds already configured across all dashboard pages, so other widgets
// (e.g. Feed Digest) can reuse them. Returns:
//   rss     — feeds from RSS widgets
//   news    — feeds from News widgets
//   reddit  — subreddits from Reddit widgets
export async function GET() {
  const rows = db.prepare("SELECT widgets FROM dashboard_layout").all() as { widgets: string }[];
  const rss: { url: string; title: string }[] = [];
  const news: { url: string; title: string }[] = [];
  const reddit: { subreddit: string }[] = [];

  for (const r of rows) {
    let widgets: StoredWidget[] = [];
    try { widgets = JSON.parse(r.widgets); } catch { continue; }
    for (const w of widgets) {
      if (w.type === "rss" && w.config?.url) {
        // Many RSS widgets keep the generic default title "RSS Feed" — fall back to the
        // domain so each feed is distinguishable in pickers (e.g. the Feed Digest checkboxes).
        const t = (w.config.title || "").trim();
        const label = t && t.toLowerCase() !== "rss feed" ? t : hostOf(w.config.url);
        rss.push({ url: w.config.url, title: label });
      }
      if (w.type === "news" && Array.isArray(w.config?.feeds)) {
        for (const u of w.config.feeds) if (u) news.push({ url: u, title: hostOf(u) });
      }
      if (w.type === "reddit" && w.config?.subreddit) reddit.push({ subreddit: w.config.subreddit });
    }
  }

  const uniq = <T extends { url?: string; subreddit?: string }>(arr: T[], key: (x: T) => string) =>
    Array.from(new Map(arr.map((x) => [key(x), x])).values());

  return NextResponse.json({
    rss: uniq(rss, (x) => x.url),
    news: uniq(news, (x) => x.url),
    reddit: uniq(reddit, (x) => x.subreddit),
  });
}
