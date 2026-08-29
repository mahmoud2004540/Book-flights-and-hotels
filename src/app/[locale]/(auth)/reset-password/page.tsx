import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { FormStatus } from "@/components/auth/form-status";

export default async function ResetPasswordPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { token } = await searchParams;
  const t = await getTranslations("auth");

  return (
    <AuthShell title={t("resetTitle")} subtitle={t("resetSubtitle")}>
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <div className="flex flex-col gap-4">
          <FormStatus tone="error">{t("resetLinkMissing")}</FormStatus>
          <Link href="/forgot-password" className="text-sm text-accent underline underline-offset-2">
            {t("requestNewLink")}
          </Link>
        </div>
      )}
    </AuthShell>
  );
}
