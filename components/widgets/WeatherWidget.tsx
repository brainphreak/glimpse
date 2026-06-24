"use client";
import { useEffect, useState } from "react";
import { Cloud, Sun, CloudRain, CloudSnow, Wind, Droplets } from "lucide-react";
import { useWidgetSettings } from "@/components/WidgetWrapper";

interface WttrHourly {
  tempC: string;
  weatherDesc: { value: string }[];
  windspeedKmph: string;
  humidity: string;
}
interface WttrDay {
  date: string;
  maxtempC: string;
  mintempC: string;
  hourly: WttrHourly[];
  weatherDesc: { value: string }[];
}
interface WttrData {
  current_condition: Array<{
    temp_C: string;
    FeelsLikeC: string;
    humidity: string;
    windspeedKmph: string;
    weatherDesc: { value: string }[];
  }>;
  weather: WttrDay[];
  nearest_area: Array<{ areaName: { value: string }[] }>;
}

function toF(c: string) {
  return Math.round(parseFloat(c) * 9 / 5 + 32).toString();
}

function WeatherIcon({ desc, size = 24 }: { desc: string; size?: number }) {
  const d = desc.toLowerCase();
  if (d.includes("snow")) return <CloudSnow size={size} color="var(--accent)" />;
  if (d.includes("rain") || d.includes("drizzle")) return <CloudRain size={size} color="var(--accent)" />;
  if (d.includes("cloud") || d.includes("overcast")) return <Cloud size={size} color="var(--text-secondary)" />;
  return <Sun size={size} color="var(--warning)" />;
}

export default function WeatherWidget({
  config,
  onConfigChange,
}: {
  config: { city?: string; unit?: "C" | "F" };
  onConfigChange?: (c: Record<string, unknown>) => void;
}) {
  const city = config.city || "New York";
  const unit = config.unit ?? "F";
  const [data, setData] = useState<WttrData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/weather?city=${encodeURIComponent(city)}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.error) { setError(j.error); return; }
        if (j.source === "wttr") setData(j.data);
      })
      .catch((e) => setError(String(e)));
  }, [city]);

  const fmt = (c: string) => unit === "F" ? toF(c) : Math.round(parseFloat(c)).toString();

  useWidgetSettings(
    <>
      <div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>City</div>
        <input
          defaultValue={config.city ?? ""}
          onBlur={(e) => { if (e.target.value !== (config.city ?? "")) onConfigChange?.({ ...config, city: e.target.value }); }}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          placeholder="New York"
          style={{ width: "100%", background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 6, padding: "5px 8px", color: "var(--text-primary)", fontSize: 12, outline: "none", boxSizing: "border-box" }}
        />
      </div>
      <div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Units</div>
        <div style={{ display: "flex", gap: 6 }}>
          {(["F", "C"] as const).map((u) => (
            <button key={u} onClick={() => onConfigChange?.({ ...config, unit: u })} style={{
              fontSize: 11, padding: "4px 12px", borderRadius: 6, border: "1px solid var(--border)", cursor: "pointer",
              background: unit === u ? "var(--accent)" : "transparent", color: unit === u ? "#fff" : "var(--text-secondary)",
            }}>°{u}</button>
          ))}
        </div>
      </div>
    </>
  );

  if (error) return <div style={{ color: "var(--danger)", padding: 14, fontSize: 13 }}>{error}</div>;
  if (!data) return <div style={{ padding: 14, color: "var(--text-muted)", fontSize: 13 }}>Loading weather…</div>;

  const current = data.current_condition[0];
  const location = data.nearest_area?.[0]?.areaName?.[0]?.value || city;
  const desc = current.weatherDesc[0]?.value || "";
  const forecast = data.weather?.slice(0, 4) || [];

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <WeatherIcon desc={desc} size={40} />
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, lineHeight: 1, color: "var(--text-primary)" }}>
              {fmt(current.temp_C)}°{unit}
            </div>
          </div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{desc}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{location}</div>
        </div>
        <div style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Droplets size={12} /> {current.humidity}%</span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Wind size={12} /> {current.windspeedKmph} km/h</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Feels {fmt(current.FeelsLikeC)}°</span>
        </div>
      </div>
      {forecast.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${forecast.length}, 1fr)`, gap: 8, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
          {forecast.map((day) => (
            <div key={day.date} style={{ textAlign: "center", fontSize: 11 }}>
              <div style={{ color: "var(--text-muted)", marginBottom: 4 }}>
                {new Date(day.date).toLocaleDateString([], { weekday: "short" })}
              </div>
              <WeatherIcon desc={day.weatherDesc?.[0]?.value || ""} size={16} />
              <div style={{ color: "var(--text-primary)", marginTop: 2 }}>{fmt(day.maxtempC)}°</div>
              <div style={{ color: "var(--text-muted)" }}>{fmt(day.mintempC)}°</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
