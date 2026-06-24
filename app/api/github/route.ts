export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getConfig } from "@/lib/config";

const GH = "https://api.github.com";

export async function GET() {
  const token = getConfig("github_token");
  if (!token) {
    return NextResponse.json({ error: "GitHub token not configured. Add it in Settings → Setup." }, { status: 503 });
  }
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "personal-dashboard",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  try {
    const userRes = await fetch(`${GH}/user`, { headers });
    if (!userRes.ok) throw new Error(`GitHub ${userRes.status} — check the token's scopes`);
    const user = await userRes.json();
    const login: string = user.login;

    const [notifRes, prRes] = await Promise.all([
      fetch(`${GH}/notifications?per_page=15`, { headers }),
      fetch(`${GH}/search/issues?q=${encodeURIComponent(`is:open is:pr author:${login}`)}&per_page=15&sort=updated`, { headers }),
    ]);

    const notifJson = notifRes.ok ? await notifRes.json() : [];
    const prJson = prRes.ok ? await prRes.json() : { items: [] };

    interface GhNotif { id: string; reason: string; subject: { title: string; type: string }; repository: { full_name: string; html_url: string }; updated_at: string }
    interface GhPr { title: string; html_url: string; number: number; repository_url: string; updated_at: string; draft?: boolean }

    const notifications = (notifJson as GhNotif[]).map((n) => ({
      id: n.id,
      reason: n.reason,
      title: n.subject?.title,
      type: n.subject?.type,
      repo: n.repository?.full_name,
      repoUrl: n.repository?.html_url,
      updated: n.updated_at,
    }));

    const prs = (prJson.items as GhPr[] || []).map((p) => ({
      title: p.title,
      url: p.html_url,
      number: p.number,
      repo: p.repository_url?.replace("https://api.github.com/repos/", ""),
      draft: p.draft,
      updated: p.updated_at,
    }));

    return NextResponse.json({ login, notifications, prs });
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
