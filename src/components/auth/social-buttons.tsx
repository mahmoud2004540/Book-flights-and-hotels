"use client";

import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/**
 * Rendered only for providers whose credentials are configured, so a button
 * is never shown that would fail on click.
 */
export function SocialButtons({
  providers,
  callbackUrl,
}: {
  providers: ReadonlyArray<"google" | "apple">;
  callbackUrl: string;
}) {
  const t = useTranslations("auth");
  if (providers.length === 0) return null;

  const labels: Record<"google" | "apple", string> = {
    google: t("continueWithGoogle"),
    apple: t("continueWithApple"),
  };

  return (
    <>
      <div className="flex flex-col gap-2">
        {providers.map((id) => (
          <Button
            key={id}
            type="button"
            variant="outline"
            size="lg"
            onClick={() => void signIn(id, { callbackUrl })}
          >
            {labels[id]}
          </Button>
        ))}
      </div>

      <div className="flex items-center gap-3 text-xs text-fg-faint">
        <span className="h-px flex-1 bg-line" />
        {t("or")}
        <span className="h-px flex-1 bg-line" />
      </div>
    </>
  );
}
