"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { FormStatus } from "./form-status";
import { AUTH_ERRORS, isAuthErrorCode } from "@/lib/auth/errors";

/**
 * Maps the code carried out of authorize() to copy the user can act on.
 * NextAuth masks the thrown error itself, so `code` is the only signal.
 */
function messageKey(code: string | undefined): string {
  if (!isAuthErrorCode(code)) return "errorInvalid";
  switch (code) {
    case AUTH_ERRORS.locked:
      return "errorLocked";
    case AUTH_ERRORS.blocked:
      return "errorBlocked";
    case AUTH_ERRORS.unverified:
      return "errorUnverified";
    default:
      return "errorInvalid";
  }
}

export function SignInForm({ callbackUrl }: { callbackUrl: string }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);

    const result = await signIn("credentials", {
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
      redirect: false,
    });

    if (result?.error) {
      setError(t(messageKey(result.code)));
      setPending(false);
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {error && <FormStatus tone="error">{error}</FormStatus>}

      <Field label={t("email")} htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>

      <div className="flex flex-col gap-1.5">
        <Field label={t("password")} htmlFor="password">
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </Field>
        <Link href="/forgot-password" className="self-start text-xs text-accent hover:underline">
          {t("forgotPassword")}
        </Link>
      </div>

      <Button type="submit" size="lg" disabled={pending}>
        {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
        {t("signIn")}
      </Button>
    </form>
  );
}
