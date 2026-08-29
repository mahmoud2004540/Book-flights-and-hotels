import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignInForm } from "@/components/auth/sign-in-form";
import { SocialButtons } from "@/components/auth/social-buttons";
import { FormStatus } from "@/components/auth/form-status";
import { enabledSocialProviders } from "@/lib/auth/providers";

export default async function SignInPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ callbackUrl?: string; reset?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { callbackUrl, reset } = await searchParams;
  const t = await getTranslations("auth");

  // Only same-origin paths are accepted, so a crafted ?callbackUrl= cannot
  // bounce a freshly signed-in user to an external site.
  const target = callbackUrl?.startsWith("/") ? callbackUrl : "/dashboard";

  return (
    <AuthShell
      title={t("signInTitle")}
      subtitle={t("signInSubtitle")}
      footer={
        <>
          {t("noAccount")}{" "}
          <Link href="/sign-up" className="text-accent underline underline-offset-2">
            {t("createAccount")}
          </Link>
        </>
      }
    >
      {reset === "1" && <FormStatus tone="success">{t("passwordResetDone")}</FormStatus>}
      <SocialButtons providers={enabledSocialProviders()} callbackUrl={target} />
      <SignInForm callbackUrl={target} />
    </AuthShell>
  );
}
