import { redirect } from "next/navigation";
import { auth } from "./index";

export type SessionUser = { id: string; email: string; name: string | null; role: string };

/**
 * Server-side guard for account pages.
 *
 * The proxy also blocks these routes, but that is a convenience redirect, not
 * the security boundary — this check runs where the data is actually read.
 */
export async function requireUser(returnTo: string): Promise<SessionUser> {
  const session = await auth();

  if (!session?.user?.id || !session.user.email) {
    redirect(`/sign-in?callbackUrl=${encodeURIComponent(returnTo)}`);
  }

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name ?? null,
    role: session.user.role,
  };
}
