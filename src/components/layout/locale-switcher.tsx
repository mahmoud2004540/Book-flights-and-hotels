"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Languages } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { LOCALES, type AppLocale } from "@/lib/config";

export function LocaleSwitcher() {
  const t = useTranslations("locale");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const other = LOCALES.find((l) => l !== locale) ?? locale;

  function switchTo(next: AppLocale): void {
    startTransition(() => {
      // usePathname يرجع المسار بدون بادئة اللغة، فيعيد التوجيه لنفس
      // الصفحة باللغة الأخرى بدل الرجوع للرئيسية.
      router.replace(pathname, { locale: next });
    });
  }

  return (
    <button
      type="button"
      onClick={() => switchTo(other)}
      disabled={isPending}
      aria-label={t("switch")}
      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 text-xs font-medium text-fg-muted transition-colors hover:text-fg disabled:opacity-60"
    >
      <Languages className="size-3.5" aria-hidden="true" />
      {t(other)}
    </button>
  );
}
