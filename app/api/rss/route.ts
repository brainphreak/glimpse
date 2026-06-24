export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import Parser from "rss-parser";

// Pull image-bearing fields that the default parser ignores.
const parser: Parser = new Parser({
  customFields: {
    item: [
      ["media:content", "mediaContent", { keepArray: true }],
      ["media:thumbnail", "mediaThumbnail", { keepArray: true }],
      ["content:encoded", "contentEncoded"],
    ],
  },
});

type MediaNode = { $?: { url?: string; medium?: string; type?: string } };

// Best-effort thumbnail for a feed item, in priority order.
function extractImage(item: Record<string, unknown>): string {
  const enclosure = item.enclosure as { url?: string; type?: string } | undefined;
  if (enclosure?.url && (!enclosure.type || enclosure.type.startsWith("image"))) return enclosure.url;

  const pick = (arr?: MediaNode[]) => {
    if (!Array.isArray(arr)) return "";
    const img = arr.find((m) => m.$?.url && (!m.$.medium || m.$.medium === "image") && (!m.$.type || m.$.type.startsWith("image")));
    return img?.$?.url || "";
  };
  const mc = pick(item.mediaContent as MediaNode[]);
  if (mc) return mc;
  const mt = pick(item.mediaThumbnail as MediaNode[]);
  if (mt) return mt;

  const html = (item.contentEncoded as string) || (item["content:encoded"] as string) || (item.content as string) || "";
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : "";
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");
  if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; DashboardRSSReader/1.0; +https://example.com)",
        "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
      },
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`Status code ${res.status}`);
    const xml = await res.text();
    const feed = await parser.parseString(xml);
    return NextResponse.json({
      title: feed.title,
      items: (feed.items || []).slice(0, 20).map((item) => ({
        title: item.title,
        link: item.link,
        pubDate: item.pubDate || item.isoDate,
        contentSnippet: item.contentSnippet?.slice(0, 200),
        image: extractImage(item as Record<string, unknown>),
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
