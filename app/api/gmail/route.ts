export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { google } from "googleapis";

export async function GET() {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  try {
    const oauth2 = new google.auth.OAuth2();
    oauth2.setCredentials({ access_token: session.accessToken });
    const gmail = google.gmail({ version: "v1", auth: oauth2 });

    // One entry per conversation: list inbox threads, then summarize each by its latest message.
    const [listRes, profileRes] = await Promise.all([
      gmail.users.threads.list({
        userId: "me",
        maxResults: 15,
        labelIds: ["INBOX"],
      }),
      gmail.users.getProfile({ userId: "me" }),
    ]);

    const messages = await Promise.all(
      (listRes.data.threads || []).map(async (t) => {
        const detail = await gmail.users.threads.get({
          userId: "me",
          id: t.id!,
          format: "metadata",
          metadataHeaders: ["Subject", "From", "Date"],
        });
        const msgs = detail.data.messages || [];
        const latest = msgs[msgs.length - 1];
        const get = (m: typeof latest | undefined, name: string) =>
          m?.payload?.headers?.find((h) => h.name === name)?.value || "";
        return {
          id: t.id,
          subject: get(msgs[0], "Subject") || get(latest, "Subject"),
          from: get(latest, "From"),
          date: get(latest, "Date"),
          unread: msgs.some((m) => m.labelIds?.includes("UNREAD")),
          snippet: latest?.snippet || t.snippet || "",
          count: msgs.length,
        };
      })
    );

    return NextResponse.json({
      messages,
      unreadCount: profileRes.data.messagesTotal,
      email: profileRes.data.emailAddress,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
