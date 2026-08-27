"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { FormStatus } from "./form-status";

export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "");
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) {
        setError(t("errorInvalidEmail"));
        setPending(false);
        return;
      }
      setSent(true);
    } catch {
      setError(t("networkError"));
      setPending(false);
    }
  }

  if (sent) {
    return <FormStatus tone="success">{t("resetLinkSent")}</FormStatus>;
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {error && <FormStatus tone="error">{error}</FormStatus>}

      <Field label={t("email")} htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>

      <Button type="submit" size="lg" disabled={pending}>
        {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
        {t("sendResetLink")}
      </Button>
    </form>
  );
}
