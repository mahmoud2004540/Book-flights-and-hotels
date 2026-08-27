import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

/** The shared frame and side navigation for every signed-in account page. */
export default async function AccountLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations("account");

  const links = [
    { href: "/dashboard", label: t("myBookings") },
    { href: "/profile", label: t("profile") },
    { href: "/travellers", label: t("travellers") },
  ] as const;

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[190px_1fr]">
      <nav aria-label={t("dashboard")} className="md:pt-1">
        <ul className="flex gap-1 overflow-x-auto md:flex-col md:gap-0.5">
          {links.map(({ href, label }) => (
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
      </nav>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
