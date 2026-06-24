"use client";
import { useCallback, useEffect, useState } from "react";
import { X, TrendingUp, TrendingDown } from "lucide-react";
import { useWidgetSettings, useWidgetRefresh } from "@/components/WidgetWrapper";

interface CryptoConfig { coins?: string[]; currency?: string }
const DEFAULT_COINS = ["bitcoin", "ethereum", "solana"];

interface Row { id: string; price: number; change: number }

export default function CryptoWidget({ config, onConfigChange }: { config: CryptoConfig; onConfigChange?: (c: Record<string, unknown>) => void }) {
  const coins = config.coins?.length ? config.coins : DEFAULT_COINS;
  const currency = (config.currency || "usd").toLowerCase();
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");

  const patch = (p: CryptoConfig) => onConfigChange?.({ coins, currency, ...p });

  const load = useCallback(() => {
    setError("");
    fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(coins.join(","))}&vs_currencies=${currency}&include_24hr_change=true`)
      .then((r) => { if (!r.ok) throw new Error(`CoinGecko ${r.status}`); return r.json(); })
      .then((j: Record<string, Record<string, number>>) => {
        setRows(coins.map((id) => ({ id, price: j[id]?.[currency] ?? NaN, change: j[id]?.[`${currency}_24h_change`] ?? 0 })));
      })
      .catch((e) => setError(String(e)));
  }, [coins, currency]);

  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, [load]);
  useWidgetRefresh(load);

  const fmt = (n: number) => isNaN(n) ? "—" : new Intl.NumberFormat([], { style: "currency", currency: currency.toUpperCase(), maximumFractionDigits: n < 1 ? 6 : 2 }).format(n);

  useWidgetSettings(
    <>
      <div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Currency</div>
        <input defaultValue={currency} onBlur={(e) => patch({ currency: e.target.value.toLowerCase() || "usd" })} placeholder="usd" style={{ width: "100%", boxSizing: "border-box", fontSize: 12, padding: "5px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-base)", color: "var(--text-primary)", outline: "none" }} />
      </div>
      <div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Coins (CoinGecko IDs)</div>
        {coins.map((c) => (
          <div key={c} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, color: "var(--text-secondary)", padding: "2px 0" }}>
            {c}
            <button onClick={() => patch({ coins: coins.filter((x) => x !== c) })} style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", padding: 0, display: "flex" }}><X size={12} /></button>
          </div>
        ))}
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="dogecoin" style={{ flex: 1, minWidth: 0, fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-base)", color: "var(--text-primary)", outline: "none" }} />
          <button onClick={() => { const c = draft.trim().toLowerCase(); if (c && !coins.includes(c)) { patch({ coins: [...coins, c] }); setDraft(""); } }} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer" }}>Add</button>
        </div>
        <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>Use CoinGecko IDs (e.g. bitcoin, ethereum, solana).</div>
      </div>
    </>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 4, overflow: "auto" }}>
      {error && <div style={{ fontSize: 11, color: "var(--danger)" }}>{error}</div>}
      {rows.map((r) => {
        const up = r.change >= 0;
        return (
          <div key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 8px", borderRadius: 8, background: "rgba(255,255,255,0.02)" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", textTransform: "capitalize" }}>{r.id}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{fmt(r.price)}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 2, fontSize: 11, color: up ? "var(--success)" : "var(--danger)", minWidth: 56, justifyContent: "flex-end" }}>
                {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}{Math.abs(r.change).toFixed(2)}%
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
