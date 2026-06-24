"use client";
import { useCallback, useEffect, useState } from "react";
import { X, TrendingUp, TrendingDown } from "lucide-react";
import { useWidgetSettings, useWidgetRefresh } from "@/components/WidgetWrapper";

interface StockConfig { symbols?: string[] }
const DEFAULT_SYMBOLS = ["AAPL", "MSFT", "NVDA", "SPY"];

interface Quote { symbol: string; name: string; price: number | null; change: number; changePct: number; currency: string; marketState: string }

export default function StockTickerWidget({ config, onConfigChange }: { config: StockConfig; onConfigChange?: (c: Record<string, unknown>) => void }) {
  const symbols = config.symbols?.length ? config.symbols : DEFAULT_SYMBOLS;
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");

  const patch = (p: StockConfig) => onConfigChange?.({ symbols, ...p });

  const load = useCallback(() => {
    setError("");
    fetch(`/api/stocks?symbols=${encodeURIComponent(symbols.join(","))}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => { if (j.error) setError(j.error); else setQuotes(j.quotes || []); })
      .catch((e) => setError(String(e)));
  }, [symbols]);

  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, [load]);
  useWidgetRefresh(load);

  const fmt = (n: number | null, cur: string) =>
    n == null ? "—" : new Intl.NumberFormat([], { style: "currency", currency: cur || "USD", maximumFractionDigits: 2 }).format(n);

  useWidgetSettings(
    <div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Symbols / tickers</div>
      {symbols.map((s) => (
        <div key={s} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, color: "var(--text-secondary)", padding: "2px 0" }}>
          {s}
          <button onClick={() => patch({ symbols: symbols.filter((x) => x !== s) })} style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", padding: 0, display: "flex" }}><X size={12} /></button>
        </div>
      ))}
      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { const s = draft.trim().toUpperCase(); if (s && !symbols.includes(s)) { patch({ symbols: [...symbols, s] }); setDraft(""); } } }} placeholder="TSLA" style={{ flex: 1, minWidth: 0, fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-base)", color: "var(--text-primary)", outline: "none" }} />
        <button onClick={() => { const s = draft.trim().toUpperCase(); if (s && !symbols.includes(s)) { patch({ symbols: [...symbols, s] }); setDraft(""); } }} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer" }}>Add</button>
      </div>
      <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>Stocks, ETFs, indices (^GSPC), or crypto (BTC-USD). Yahoo Finance symbols.</div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 4, overflow: "auto" }}>
      {error && <div style={{ fontSize: 11, color: "var(--danger)" }}>{error}</div>}
      {quotes.map((q) => {
        const up = q.change >= 0;
        return (
          <div key={q.symbol} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 8px", borderRadius: 8, background: "rgba(255,255,255,0.02)" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{q.symbol}</div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 130 }}>{q.name}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{fmt(q.price, q.currency)}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 2, fontSize: 11, color: up ? "var(--success)" : "var(--danger)", minWidth: 60, justifyContent: "flex-end" }}>
                {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}{Math.abs(q.changePct).toFixed(2)}%
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
