import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { BRAND } from "@/lib/config";

/**
 * الصفحات القانونية المطلوبة في القسم 14. الروابط موجودة من الآن
 * حتى لا تُنسى، ومحتواها يُكتب في المرحلة 8 قبل الإطلاق.
 */
const LEGAL_LINKS = [
  { key: "terms", href: "/terms" },
  { key: "privacy", href: "/privacy" },
  { key: "cookies", href: "/cookies" },
  { key: "refunds", href: "/refunds" },
] as const;

const COMPANY_LINKS = [
  { key: "about", href: "/about" },
  { key: "contact", href: "/contact" },
] as const;

export function SiteFooter({ localeIsAr }: { localeIsAr: boolean }) {
  const t = useTranslations("footer");
  const year = new Date().getFullYear();
  const brandName = localeIsAr ? BRAND.nameAr : BRAND.nameEn;

  return (
    <footer className="mt-24 border-t border-line bg-surface">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-3 sm:px-6">
        <div>
          <p className="font-semibold">{brandName}</p>
          <p className="mt-1 max-w-xs text-sm text-fg-muted">{t("tagline")}</p>
        </div>

        <nav aria-labelledby="footer-company">
          <p id="footer-company" className="label-caps text-xs font-semibold text-fg-faint">
            {t("company")}
          </p>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {COMPANY_LINKS.map(({ key, href }) => (
              <li key={key}>
                <Link href={href} className="text-fg-muted hover:text-fg">
                  {t(key)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-labelledby="footer-legal">
          <p id="footer-legal" className="label-caps text-xs font-semibold text-fg-faint">
            {t("legal")}
          </p>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {LEGAL_LINKS.map(({ key, href }) => (
              <li key={key}>
                <Link href={href} className="text-fg-muted hover:text-fg">
                  {t(key)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="border-t border-line-soft">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-fg-faint sm:px-6">
          © <span className="tabular">{year}</span> {brandName}. {t("rights")}
        </p>
      </div>
    </footer>
  );
}
