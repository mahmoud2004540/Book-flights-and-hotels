"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { FormStatus } from "./form-status";
import { signUpSchema } from "@/lib/validation/auth";
import { toFieldErrors, type FieldErrors } from "@/lib/validation/errors";

type State =
  | { phase: "idle" | "submitting" }
  | { phase: "sent"; email: string }
  | { phase: "error"; message: string };

export function SignUpForm() {
  const t = useTranslations("auth");
  const [state, setState] = useState<State>({ phase: "idle" });
  const [errors, setErrors] = useState<FieldErrors>({});

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    // Validated client-side with the same schema the route uses, so an obvious
    // mistake is caught without a round trip and the messages always match.
    const parsed = signUpSchema.safeParse({
      name: form.get("name"),
      email: form.get("email"),
      password: form.get("password"),
    });

    if (!parsed.success) {
      setErrors(toFieldErrors(parsed.error));
      return;
    }

    setErrors({});
    setState({ phase: "submitting" });

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body = (await response.json()) as {
        ok: boolean;
        fieldErrors?: FieldErrors;
      };

      if (!response.ok || !body.ok) {
        if (body.fieldErrors) setErrors(body.fieldErrors);
        setState({ phase: "error", message: t("signUpFailed") });
        return;
      }

      setState({ phase: "sent", email: parsed.data.email });
    } catch {
      setState({ phase: "error", message: t("networkError") });
    }
  }

  if (state.phase === "sent") {
    return (
      <FormStatus tone="success">
        <p className="font-medium">{t("checkInbox")}</p>
        <p className="mt-1">{t("verificationSentTo", { email: state.email })}</p>
      </FormStatus>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {state.phase === "error" && <FormStatus tone="error">{state.message}</FormStatus>}

      <Field label={t("name")} htmlFor="name" error={errors.name}>
        <Input id="name" name="name" autoComplete="name" required />
      </Field>

      <Field label={t("email")} htmlFor="email" error={errors.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>

      <Field
        label={t("password")}
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

      <Button type="submit" size="lg" disabled={state.phase === "submitting"}>
        {state.phase === "submitting" && <Loader2 className="animate-spin" aria-hidden="true" />}
        {t("createAccount")}
      </Button>
    </form>
  );
}
