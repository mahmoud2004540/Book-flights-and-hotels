import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  const t = useTranslations("notFound");

  return (
    <div className="mx-auto flex max-w-lg flex-col items-start gap-4 px-4 py-24 sm:px-6">
      <p className="font-mono text-sm text-brand">404</p>
      <h1 className="text-3xl font-semibold text-balance">{t("title")}</h1>
      <p className="text-fg-muted">{t("body")}</p>
      <Link href="/" className={buttonVariants({ variant: "primary" })}>
        {t("home")}
      </Link>
    </div>
  );
}
