import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest, NextFetchEvent } from "next/server";

// Routes that must be accessible without auth (the auth flow itself)
const PUBLIC_PATHS = ["/api/auth"];

const authMiddleware = auth((req) => {
  const { pathname } = req.nextUrl;

  // Allow NextAuth internals through
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Block everything else unless signed in
  if (!req.auth) {
    const signInUrl = new URL("/api/auth/signin", req.url);
    signInUrl.searchParams.set("callbackUrl", req.url);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
});

// Local-dev escape hatch: when DISABLE_AUTH=1, skip auth entirely so the app runs over
// http://localhost without Google OAuth (e.g. to test Ollama). NEVER set this in production —
// it is unset on the server, so the bypass is dev-only.
export default function middleware(req: NextRequest, ev: NextFetchEvent) {
  if (process.env.DISABLE_AUTH === "1") return NextResponse.next();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (authMiddleware as any)(req, ev);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public).*)"],
};
