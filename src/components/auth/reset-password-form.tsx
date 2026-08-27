"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { FormStatus } from "./form-status";
import { resetPasswordSchema } from "@/lib/validation/auth";
import { toFieldErrors, type FieldErrors } from "@/lib/validation/errors";

export function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get("password") ?? "");

    const parsed = resetPasswordSchema.safeParse({ token, password });
    if (!parsed.success) {
      setErrors(toFieldErrors(parsed.error));
      return;
    }

    setErrors({});
    setFormError(null);
    setPending(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body = (await response.json()) as { ok: boolean; reason?: string };

      if (!response.ok || !body.ok) {
        // An expired or already-used link is the common case, and the fix is
        // to request a new one — so say that rather than "invalid token".
        setFormError(
          body.reason === "expired" || body.reason === "used"
            ? t("resetLinkExpired")
            : t("resetFailed"),
        );
        setPending(false);
        return;
      }

      router.push("/sign-in?reset=1");
    } catch {
      setFormError(t("networkError"));
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {formError && <FormStatus tone="error">{formError}</FormStatus>}

      <Field
        label={t("newPassword")}
        htmlFor="password"
        hint={t("passwordHint")}
        error={errors.password}
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
        />
      </Field>

      <Button type="submit" size="lg" disabled={pending}>
        {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
        {t("setNewPassword")}
      </Button>
    </form>
  );
}
