"use client";

import { useEffect, useRef, useState } from "react";
import { CreditCard, Loader2, ShieldCheck } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { FormStatus } from "@/components/auth/form-status";
import { formatAmount } from "@/lib/format";

type Phase = "creating" | "ready" | "paying" | "settling" | "failed";

/**
 * The payment step.
 *
 * With Stripe configured this hosts Stripe Elements, so card details go
 * straight from the browser to Stripe and never touch our servers — the reason
 * we stay inside PCI-DSS SAQ-A. Against the mock provider it confirms directly,
 * which is what makes the whole settlement path testable without a live key.
 */
export function PayPanel({
  reference,
  email,
  amount,
  currency,
  mockMode,
}: {
  reference: string;
  email: string;
  amount: string;
  currency: string;
  mockMode: boolean;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("creating");
  const [error, setError] = useState<string | null>(null);
  const providerRef = useRef<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    void (async () => {
      try {
        const response = await fetch("/api/payments/intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reference, email }),
        });
        const body = (await response.json()) as {
          ok?: boolean;
          providerRef?: string;
          reason?: string;
        };

        if (!body.ok || !body.providerRef) {
          setError(
            body.reason === "no_provider"
              ? "No payment provider is configured yet."
              : "We could not start the payment. Try again.",
          );
          setPhase("failed");
          return;
        }
        providerRef.current = body.providerRef;
        setPhase("ready");
      } catch {
        setError("We could not reach the server.");
        setPhase("failed");
      }
    })();
  }, [reference, email]);

  async function pay() {
    if (!providerRef.current) return;
    setPhase("paying");
    setError(null);

    try {
      const response = await fetch("/api/payments/confirm-mock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerRef: providerRef.current }),
      });
      const body = (await response.json()) as { ok?: boolean; outcome?: string; reason?: string };

      if (!body.ok) {
        setError(
          body.reason === "declined"
            ? "That payment was declined. Try a different card."
            : "The payment did not go through. Try again.",
        );
        setPhase("failed");
        return;
      }

      setPhase("settling");
      // Both outcomes are shown on the booking page, which reads the real state
      // rather than trusting what this component thinks happened.
      router.push(`/booking/confirmed/${reference}`);
      router.refresh();
    } catch {
      setError("We could not reach the server.");
      setPhase("failed");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <FormStatus tone="error">{error}</FormStatus>}

      <Card>
        <CardBody className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <CreditCard className="mt-0.5 size-5 text-fg-muted" aria-hidden="true" />
            <div className="min-w-0">
              <h2 className="font-semibold">Pay for booking {reference}</h2>
              <p className="mt-1 text-sm text-fg-muted tabular">
                {formatAmount(amount, currency)} · charged once
              </p>
            </div>
          </div>

          {mockMode ? (
            <div className="rounded-md border border-line bg-surface-2 px-3.5 py-3 text-sm text-fg-muted">
              <p className="font-medium text-fg">Test payment mode</p>
              <p className="mt-1">
                No card is taken and no money moves. This exercises the real settlement path —
                the booking is confirmed, or refunded automatically if issuance fails.
              </p>
            </div>
          ) : (
            <div
              id="stripe-elements"
              className="min-h-[8rem] rounded-md border border-line p-3"
              aria-label="Card details"
            />
          )}

          <Button
            size="lg"
            onClick={() => void pay()}
            disabled={phase !== "ready"}
          >
            {(phase === "creating" || phase === "paying" || phase === "settling") && (
              <Loader2 className="animate-spin" aria-hidden="true" />
            )}
            {phase === "creating" && "Preparing payment…"}
            {phase === "ready" && `Pay ${formatAmount(amount, currency)}`}
            {phase === "paying" && "Taking payment…"}
            {phase === "settling" && "Confirming with the airline…"}
            {phase === "failed" && "Try again"}
          </Button>

          <p className="flex items-center gap-2 text-xs text-fg-faint">
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            Card details go straight to our payment provider and never reach our servers.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
