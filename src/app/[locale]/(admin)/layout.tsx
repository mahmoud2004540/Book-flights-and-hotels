import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireStaff } from "@/lib/auth/admin-guard";
import { can, type Capability } from "@/lib/admin/permissions";

/**
 * The admin shell.
 *
 * The navigation is filtered by capability, so nobody is offered a page that
 * would refuse them. That is courtesy, not security — each page guards itself.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations("admin");
  const staff = await requireStaff();

  const links: Array<{ href: string; label: string; needs: Capability }> = [
    { href: "/admin", label: t("overview"), needs: "bookings.read" },
    { href: "/admin/bookings", label: t("bookings"), needs: "bookings.read" },
    { href: "/admin/users", label: t("users"), needs: "users.read" },
    { href: "/admin/markup", label: t("markup"), needs: "markup.read" },
    { href: "/admin/suppliers", label: t("suppliers"), needs: "suppliers.read" },
  ];

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[200px_1fr]">
      <nav aria-label={t("title")} className="flex flex-col gap-3 md:pt-1">
        <p className="px-3 text-xs font-semibold tracking-wide text-fg-faint uppercase">
          {t("title")}
        </p>
        <ul className="flex gap-1 overflow-x-auto md:flex-col md:gap-0.5">
          {links
            .filter((link) => can(staff.role, link.needs))
            .map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="block rounded-md px-3 py-2 text-sm whitespace-nowrap text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
                >
                  {label}
                </Link>
              </li>
            ))}
        </ul>
        <p className="px-3 text-xs text-fg-faint">
          {t("signedInAs", { email: staff.email, role: staff.role.toLowerCase().replace("_", " ") })}
        </p>
      </nav>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
