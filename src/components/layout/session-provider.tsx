"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

/**
 * next-auth's provider is a client component, so it needs this wrapper to be
 * used from the server layout.
 */
export function AuthSessionProvider({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
