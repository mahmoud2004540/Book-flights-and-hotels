import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { contentSecurityPolicy } from "@/lib/security/csp";

const intlProxy = createMiddleware(routing);

/** Routes that require a session. Checked again server-side where data is read. */
const PROTECTED = ["/dashboard", "/profile", "/travellers", "/bookings", "/admin"];

/**
 * Locale resolution, the content-security policy, and a cheap signed-out
 * redirect for account routes.
 *
 * The session check here only looks for a cookie — it does not verify it.
 * Verification needs the database, which the proxy runtime should not touch;
 * the real guard is requireUser() and requireCapability() on each page.
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

  const response = intlProxy(request);
  // Set here rather than in next.config.ts only because the dev build needs a
  // looser policy than production; the value itself is static per environment.
  response.headers.set(
    "content-security-policy",
    contentSecurityPolicy(process.env.NODE_ENV !== "production"),
  );
  return response;
}

export const config = {
  // Everything except API routes, static assets and files with an extension.
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
