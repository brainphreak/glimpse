export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { google } from "googleapis";

// Accepts a spreadsheet ID or a full Google Sheets URL.
function parseId(input: string): string {
  const m = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : input.trim();
}

// A1 notation needs sheet names with spaces single-quoted (e.g. 'Google Voice Log'!A1:Z500).
function normalizeRange(range: string): string {
  const i = range.lastIndexOf("!");
  if (i <= 0) return range;
  let sheet = range.slice(0, i);
  const cells = range.slice(i + 1);
  if (!sheet.startsWith("'") && /\s/.test(sheet)) sheet = `'${sheet.replace(/'/g, "''")}'`;
  return `${sheet}!${cells}`;
}

// Minimal RFC-4180 CSV parser (handles quoted commas/newlines and "" escapes).
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
    else if (c !== "\r") cur += c;
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

function toHeadersRows(values: string[][]) {
  if (!values.length) return { headers: [], rows: [] };
  const headers = values[0].map((h) => String(h ?? "").trim());
  const rows = values.slice(1).map((r) => {
    const o: Record<string, string> = {};
    headers.forEach((h, i) => { o[h] = String(r[i] ?? ""); });
    return o;
  });
  return { headers, rows };
}

// Try the public CSV export (works when the sheet is "anyone with the link can view" or published).
async function tryPublic(id: string, range: string) {
  const i = range.lastIndexOf("!");
  let params = "";
  if (i > 0) {
    const sheet = range.slice(0, i).replace(/^'|'$/g, "");
    const cells = range.slice(i + 1);
    // Column-only ranges (e.g. A:Z) aren't valid gviz A1 ranges — fetch the whole tab instead.
    params = /^[A-Za-z]+:[A-Za-z]+$/.test(cells) ? `sheet=${encodeURIComponent(sheet)}` : `sheet=${encodeURIComponent(sheet)}&range=${encodeURIComponent(cells)}`;
  } else if (/^[A-Za-z]+\d*(:[A-Za-z]+\d*)?$/.test(range)) {
    params = `range=${encodeURIComponent(range)}`;
  } else {
    params = `sheet=${encodeURIComponent(range)}`;
  }
  const url = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&headers=1&${params}`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (DashboardSheets/1.0)" }, redirect: "follow" });
  if (!res.ok) return null;
  const text = await res.text();
  // Private sheets return an HTML sign-in page instead of CSV.
  if (/^\s*<|<!DOCTYPE|accounts\.google|<html/i.test(text.slice(0, 200))) return null;
  return toHeadersRows(parseCSV(text));
}

// Try the authenticated Sheets API (private sheets the signed-in user can access).
async function tryApi(id: string, range: string, accessToken: string) {
  const oauth2 = new google.auth.OAuth2();
  oauth2.setCredentials({ access_token: accessToken });
  const sheets = google.sheets({ version: "v4", auth: oauth2 });
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: id, range: normalizeRange(range) });
  return toHeadersRows((res.data.values || []) as string[][]);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const idParam = searchParams.get("id");
  const range = searchParams.get("range") || "A1:Z500";
  if (!idParam) return NextResponse.json({ error: "id (spreadsheet URL or ID) required" }, { status: 400 });
  const id = parseId(idParam);

  const session = await auth();
  const token = session?.accessToken;

  // Prefer the authenticated API when signed in (covers private sheets); fall back to public.
  // When not signed in, use the public export only.
  try {
    if (token) {
      try {
        const out = await tryApi(id, range, token);
        return NextResponse.json({ ...out, source: "api" });
      } catch {
        const pub = await tryPublic(id, range);
        if (pub) return NextResponse.json({ ...pub, source: "public" });
        return NextResponse.json({ error: "No access. Make sure the sheet is shared with your Google account (or set link-sharing/Publish to web), and that the Google Sheets API is enabled in your Cloud project." }, { status: 403 });
      }
    } else {
      const pub = await tryPublic(id, range);
      if (pub) return NextResponse.json({ ...pub, source: "public" });
      return NextResponse.json({ error: "This sheet isn't public. Sign in with Google to read a private sheet, or set the sheet to 'anyone with the link can view'." }, { status: 401 });
    }
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
