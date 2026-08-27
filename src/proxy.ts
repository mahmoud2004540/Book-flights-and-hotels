import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

/**
 * Locale resolution. Next 16 renamed this layer from middleware to proxy.
 */
export default createMiddleware(routing);

export const config = {
  // Everything except API routes, static assets and files with an extension.
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
