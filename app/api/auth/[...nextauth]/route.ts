export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { getConfig } from "@/lib/config";
import type { NextRequest } from "next/server";

const GOOGLE_SCOPES = [
  "openid", "email", "profile",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/gmail.readonly",
].join(" ");

async function refreshAccessToken(token: Record<string, unknown>) {
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: getConfig("google_client_id"),
        client_secret: getConfig("google_client_secret"),
        grant_type: "refresh_token",
        refresh_token: token.refreshToken as string,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw data;
    return { ...token, accessToken: data.access_token, expiresAt: Math.floor(Date.now() / 1000) + data.expires_in };
  } catch {
    return { ...token, error: "RefreshAccessTokenError" };
  }
}

// Lazily created so NextAuth() is never called at module load / build time
let _handlers: ReturnType<typeof NextAuth>["handlers"] | null = null;

function getHandlers() {
  if (_handlers) return _handlers;

  const clientId = getConfig("google_client_id");
  const clientSecret = getConfig("google_client_secret");

  const { handlers } = NextAuth({
    trustHost: true,
    providers: clientId && clientSecret
      ? [Google({ clientId, clientSecret, authorization: { params: { scope: GOOGLE_SCOPES, access_type: "offline", prompt: "consent" } } })]
      : [],
    callbacks: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async jwt(params: any) {
        const { token, account } = params;
        if (account) return { ...token, accessToken: account.access_token, refreshToken: account.refresh_token, expiresAt: account.expires_at };
        if (Date.now() / 1000 < (token.expiresAt as number) - 60) return token;
        return refreshAccessToken(token);
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async session(params: any) {
        const { session, token } = params;
        session.accessToken = token.accessToken;
        session.error = token.error;
        return session;
      },
    },
  });

  _handlers = handlers;
  return handlers;
}

export async function GET(req: NextRequest) {
  return getHandlers().GET(req);
}

export async function POST(req: NextRequest) {
  return getHandlers().POST(req);
}
