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

    const [listRes, profileRes] = await Promise.all([
      gmail.users.messages.list({
        userId: "me",
        maxResults: 15,
        labelIds: ["INBOX"],
      }),
      gmail.users.getProfile({ userId: "me" }),
    ]);

    const messages = await Promise.all(
      (listRes.data.messages || []).map(async (msg) => {
        const detail = await gmail.users.messages.get({
          userId: "me",
          id: msg.id!,
          format: "metadata",
          metadataHeaders: ["Subject", "From", "Date"],
        });
        const headers = detail.data.payload?.headers || [];
        const get = (name: string) =>
          headers.find((h) => h.name === name)?.value || "";
        return {
          id: msg.id,
          subject: get("Subject"),
          from: get("From"),
          date: get("Date"),
          unread: detail.data.labelIds?.includes("UNREAD") ?? false,
          snippet: detail.data.snippet || "",
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
