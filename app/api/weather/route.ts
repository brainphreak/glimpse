export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getConfig } from "@/lib/config";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get("city") || getConfig("weather_city") || "New York";
  const apiKey = getConfig("openweathermap_api_key");

  try {
    if (apiKey) {
      const res = await fetch(
        `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric&cnt=8`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("OWM error");
      const data = await res.json();
      return NextResponse.json({ source: "owm", data });
    }

    // Fallback: wttr.in (no key required)
    const res = await fetch(
      `https://wttr.in/${encodeURIComponent(city)}?format=j1`,
      { cache: "no-store" }
    );
    if (!res.ok) throw new Error("wttr error");
    const data = await res.json();
    return NextResponse.json({ source: "wttr", data });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
