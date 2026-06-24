export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

// Free, keyless quotes via Yahoo Finance's public chart endpoint (proxied server-side
// to avoid CORS). Returns price + previous close so we can show the day's change.
async function quote(symbol: string) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; DashboardStocks/1.0)" },
  });
  if (!res.ok) throw new Error(`Yahoo ${res.status}`);
  const json = await res.json();
  const meta = json?.chart?.result?.[0]?.meta;
  if (!meta) throw new Error("no data");
  const price = meta.regularMarketPrice ?? null;
  const prev = meta.previousClose ?? meta.chartPreviousClose ?? null;
  const change = price != null && prev != null ? price - prev : 0;
  const changePct = prev ? (change / prev) * 100 : 0;
  return {
    symbol: meta.symbol || symbol,
    name: meta.shortName || meta.longName || meta.symbol || symbol,
    price,
    prevClose: prev,
    change,
    changePct,
    currency: meta.currency || "USD",
    marketState: meta.marketState || "",
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbols = (searchParams.get("symbols") || "")
    .split(",").map((s) => s.trim().toUpperCase()).filter(Boolean).slice(0, 25);
  if (!symbols.length) return NextResponse.json({ error: "symbols required" }, { status: 400 });

  const results = await Promise.allSettled(symbols.map(quote));
  const quotes = results.map((r, i) =>
    r.status === "fulfilled" ? r.value : { symbol: symbols[i], name: symbols[i], price: null, prevClose: null, change: 0, changePct: 0, currency: "USD", marketState: "", error: String((r as PromiseRejectedResult).reason) }
  );
  return NextResponse.json({ quotes });
}
