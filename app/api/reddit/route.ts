export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const subreddit = searchParams.get("subreddit") || "all";
  const sort = searchParams.get("sort") || "hot";
  const limit = searchParams.get("limit") || "20";

  try {
    const res = await fetch(
      `https://www.reddit.com/r/${subreddit}/${sort}.json?limit=${limit}&raw_json=1`,
      {
        headers: { "User-Agent": "personal-dashboard/1.0" },
        next: { revalidate: 300 },
      }
    );
    if (!res.ok) throw new Error(`Reddit ${res.status}`);
    const json = await res.json();
    const posts = (json.data?.children || []).map((c: {data: Record<string, unknown>}) => ({
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
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
