// Edge-runtime-safe: only uses process.env, no native modules.
// Google credentials come from env vars here (used by middleware for session verification).
// The actual OAuth callback route (app/api/auth/[...nextauth]/route.ts) overrides these
// with DB-stored values for the interactive sign-in flow.
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const clientId = process.env.GOOGLE_CLIENT_ID ?? "";
const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "";

async function refreshAccessToken(token: Record<string, unknown>) {
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
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

const GOOGLE_SCOPES = [
  "openid", "email", "profile",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/gmail.readonly",
].join(" ");

export const { handlers, auth, signIn, signOut } = NextAuth({
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

declare module "next-auth" {
  interface Session { accessToken?: string; error?: string; }
}
