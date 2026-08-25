import { useTranslations } from "next-intl";
import { Plane } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { BRAND } from "@/lib/config";
import { Button } from "@/components/ui/button";
import { LocaleSwitcher } from "./locale-switcher";
import { ThemeToggle } from "./theme-toggle";

export function SiteHeader({ localeIsAr }: { localeIsAr: boolean }) {
  const t = useTranslations("nav");

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ground/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 font-semibold tracking-tight"
        >
          <Plane className="size-5 text-brand" aria-hidden="true" />
          <span className="text-base">{localeIsAr ? BRAND.nameAr : BRAND.nameEn}</span>
        </Link>

        <nav className="hidden items-center gap-1 sm:flex" aria-label={t("openMenu")}>
          <Button variant="ghost" size="sm" disabled>
            {t("flights")}
          </Button>
          <Button variant="ghost" size="sm" disabled>
            {t("hotels")}
          </Button>
        </nav>

        <div className="ms-auto flex items-center gap-2">
          <LocaleSwitcher />
          <ThemeToggle />
          <Button variant="outline" size="sm" disabled className="hidden sm:inline-flex">
            {t("signIn")}
          </Button>
        </div>
      </div>
    </header>
  );
}
