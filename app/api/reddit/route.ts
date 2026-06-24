export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getConfig } from "@/lib/config";

const UA = "web:glimpse-dashboard:1.1 (personal self-hosted dashboard)";

// Reddit blocks anonymous/automated access, so we authenticate with app-only OAuth
// (client_credentials) using a registered Reddit app's client id + secret.
let cachedToken: { token: string; expires: number } | null = null;

async function getToken(id: string, secret: string): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expires) return cachedToken.token;
  const auth = Buffer.from(`${id}:${secret}`).toString("base64");
  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": UA,
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`Reddit auth failed (${res.status}). Check the client ID/secret, and that the app is approved.`);
  const data = await res.json();
  if (!data.access_token) throw new Error("Reddit auth returned no token.");
  cachedToken = { token: data.access_token, expires: Date.now() + (data.expires_in - 60) * 1000 };
  return data.access_token;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const subreddit = searchParams.get("subreddit") || "all";
  const sort = searchParams.get("sort") || "hot";
  const limit = searchParams.get("limit") || "20";

  const id = getConfig("reddit_client_id");
  const secret = getConfig("reddit_client_secret");
  if (!id || !secret) {
    return NextResponse.json(
      { error: "Reddit needs API credentials. Create an app at reddit.com/prefs/apps and add the client ID + secret in Settings → Setup." },
      { status: 503 }
    );
  }

  try {
    const token = await getToken(id, secret);
    const res = await fetch(
      `https://oauth.reddit.com/r/${encodeURIComponent(subreddit)}/${encodeURIComponent(sort)}?limit=${encodeURIComponent(limit)}&raw_json=1`,
      { headers: { Authorization: `Bearer ${token}`, "User-Agent": UA } }
    );
    if (!res.ok) {
      // A stale cached token can 401 — clear it so the next call re-auths.
      if (res.status === 401) cachedToken = null;
      throw new Error(`Reddit ${res.status}`);
    }
    const json = await res.json();
    const posts = (json.data?.children || []).map((c: { data: Record<string, unknown> }) => ({
      id: c.data.id,
      title: c.data.title,
      subreddit: c.data.subreddit,
      author: c.data.author,
      score: c.data.score,
      numComments: c.data.num_comments,
      url: c.data.url,
      permalink: `https://reddit.com${c.data.permalink}`,
      thumbnail: c.data.thumbnail,
      isVideo: c.data.is_video,
      selftext: (c.data.selftext as string)?.slice(0, 300),
      created: c.data.created_utc,
    }));
    return NextResponse.json({ subreddit, posts });
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
