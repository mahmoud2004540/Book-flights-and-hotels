"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { FormStatus } from "./form-status";

type Phase = "checking" | "done" | "failed";

export function VerifyEmailClient({ token }: { token: string | null }) {
  const t = useTranslations("auth");
  const [phase, setPhase] = useState<Phase>(token ? "checking" : "failed");
  const [reason, setReason] = useState<string>("invalid");
  // React runs effects twice in development; without this guard the token is
  // consumed by the first pass and the second reports it as already used.
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;

    void (async () => {
      try {
        const response = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const body = (await response.json()) as { ok: boolean; reason?: string };
        if (body.ok) {
          setPhase("done");
        } else {
          setReason(body.reason ?? "invalid");
          setPhase("failed");
        }
      } catch {
        setReason("network");
        setPhase("failed");
      }
    })();
  }, [token]);

  if (phase === "checking") {
    return (
      <p className="flex items-center gap-2 text-sm text-fg-muted">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        {t("verifying")}
      </p>
    );
  }

  if (phase === "done") {
    return (
      <div className="flex flex-col gap-4">
        <FormStatus tone="success">{t("emailVerified")}</FormStatus>
        <Link href="/sign-in" className={buttonVariants({ size: "lg" })}>
          {t("signIn")}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <FormStatus tone="error">
        {reason === "expired" ? t("verifyLinkExpired") : t("verifyLinkInvalid")}
      </FormStatus>
      <Link href="/sign-up" className={buttonVariants({ variant: "outline", size: "lg" })}>
        {t("backToSignUp")}
      </Link>
    </div>
  );
}
