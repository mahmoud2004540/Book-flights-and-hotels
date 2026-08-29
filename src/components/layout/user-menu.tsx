"use client";

import { signOut, useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { LogOut, ShieldCheck, User } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { isStaff } from "@/lib/admin/permissions";

/**
 * Signed out, this is the sign-in button; signed in, it is the account link
 * plus sign out. Rendered client-side so it reflects a session change without
 * a full reload.
 */
export function UserMenu() {
  const t = useTranslations("auth");
  const tAccount = useTranslations("account");
  const tAdmin = useTranslations("admin");
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
      {/* Staff only. The link is a shortcut, not access: the admin area is
          guarded on every page and every route, and to anyone else it 404s. */}
      {isStaff(session.user.role) && (
        <Link
          href="/admin"
          className={buttonVariants({ variant: "ghost", size: "sm" })}
          title={tAdmin("title")}
        >
          <ShieldCheck aria-hidden="true" />
          <span className="hidden sm:inline">{tAdmin("title")}</span>
        </Link>
      )}
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
