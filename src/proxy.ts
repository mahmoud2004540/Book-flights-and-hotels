import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";

const intlProxy = createMiddleware(routing);

/** Routes that require a session. Checked again server-side where data is read. */
const PROTECTED = ["/dashboard", "/profile", "/travellers", "/bookings", "/admin"];

/**
 * Locale resolution, plus a cheap signed-out redirect for account routes.
 *
 * This only checks that a session cookie is present — it does not verify it.
 * Verification needs the database, which the proxy runtime should not touch;
 * the real guard is requireUser() on each page.
 */
export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PROTECTED.some((route) => pathname.startsWith(route))) {
    const hasSession =
      request.cookies.has("authjs.session-token") ||
      request.cookies.has("__Secure-authjs.session-token");

    if (!hasSession) {
      const signIn = new URL("/sign-in", request.url);
      signIn.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(signIn);
    }
  }

  return intlProxy(request);
}

export const config = {
  // Everything except API routes, static assets and files with an extension.
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
