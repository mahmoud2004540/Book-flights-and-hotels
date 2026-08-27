"use client";

import { signOut, useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { LogOut, User } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button, buttonVariants } from "@/components/ui/button";

/**
 * Signed out, this is the sign-in button; signed in, it is the account link
 * plus sign out. Rendered client-side so it reflects a session change without
 * a full reload.
 */
export function UserMenu() {
  const t = useTranslations("auth");
  const tAccount = useTranslations("account");
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <div className="h-8 w-20 animate-pulse rounded-md bg-surface-2" aria-hidden="true" />;
  }

  if (!session?.user) {
    return (
      <Link href="/sign-in" className={buttonVariants({ variant: "outline", size: "sm" })}>
        {t("signIn")}
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Link
        href="/dashboard"
        className={buttonVariants({ variant: "ghost", size: "sm" })}
        title={tAccount("dashboard")}
      >
        <User aria-hidden="true" />
        <span className="hidden sm:inline">
          {session.user.name ?? tAccount("dashboard")}
        </span>
      </Link>
      <Button
        variant="ghost"
        size="icon"
        aria-label={t("signOut")}
        title={t("signOut")}
        onClick={() => void signOut({ callbackUrl: "/" })}
      >
        <LogOut aria-hidden="true" />
      </Button>
    </div>
  );
}
