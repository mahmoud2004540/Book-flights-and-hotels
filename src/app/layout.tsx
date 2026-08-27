import type { ReactNode } from "react";

/**
 * The root layout does not render <html> — the locale layout does, because
 * lang and dir are only known once the locale is resolved from the route.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
