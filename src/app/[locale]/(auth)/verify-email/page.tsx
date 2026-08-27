import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { VerifyEmailClient } from "@/components/auth/verify-email-client";

export default async function VerifyEmailPage({
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
    <AuthShell title={t("verifyTitle")}>
      <VerifyEmailClient token={token ?? null} />
    </AuthShell>
  );
}
