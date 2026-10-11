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
      ["image", "itemImage"],
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

  // Some feeds (e.g. WeLiveSecurity) use a non-standard item-level <image>URL</image>.
  const itemImage = item.itemImage as string | { url?: string; _?: string } | undefined;
  if (typeof itemImage === "string" && /^https?:\/\//i.test(itemImage.trim())) return itemImage.trim();
  if (itemImage && typeof itemImage === "object") {
    const u = itemImage.url || itemImage._;
    if (u && /^https?:\/\//i.test(u)) return u;
  }

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
        // A realistic browser UA gets past many basic bot filters that block generic clients.
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.9, */*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`Status code ${res.status}`);
    let xml = await res.text();
    xml = xml.replace(/^﻿/, "").replace(/^[\s​]+/, "");                 // strip BOM / leading whitespace
    // If the server returned a web page (captcha / bot block / error page), say so clearly
    // instead of letting the XML parser fail with a cryptic "invalid character".
    const head = xml.slice(0, 600).toLowerCase();
    if (head.includes("<!doctype html") || head.startsWith("<html") || head.includes("recaptcha") || head.includes("captcha")) {
      throw new Error("The feed returned a web page (likely a captcha / bot-block), not a feed. Try again later or use a different source — some sites block automated requests from servers.");
    }
    xml = xml.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");                       // strip invalid XML control chars
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
