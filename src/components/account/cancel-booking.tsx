"use client";

import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { FormStatus } from "@/components/auth/form-status";
import { formatAmount } from "@/lib/format";

type Quote = {
  allowed: boolean;
  refundAmount?: string;
  fee?: string;
  currency?: string;
  reason: string;
};

/**
 * Cancellation, in two deliberate steps — section 4.6.
 *
 * The refundable amount is fetched and shown before anything is cancelled,
 * because a refund figure discovered afterwards is how trust is lost. The
 * server re-quotes on confirm rather than trusting what was displayed.
 */
export function CancelBooking({ reference }: { reference: string }) {
  const router = useRouter();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadQuote() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/bookings/${reference}/cancel`);
      const body = (await response.json()) as { ok?: boolean; quote?: Quote };
      if (!body.ok || !body.quote) {
        setError("We could not work out the refund. Try again.");
        return;
      }
      setQuote(body.quote);
    } catch {
      setError("We could not reach the server.");
    } finally {
      setPending(false);
    }
  }

  async function confirmCancel() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/bookings/${reference}/cancel`, { method: "POST" });
      const body = (await response.json()) as { ok?: boolean; reason?: string };
      if (!body.ok) {
        setError(body.reason ?? "We could not cancel this booking.");
        return;
      }
      router.refresh();
      setQuote(null);
    } catch {
      setError("We could not reach the server.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardBody className="flex flex-col gap-4">
        <h2 className="font-semibold">Cancel this booking</h2>
        {error && <FormStatus tone="error">{error}</FormStatus>}

        {quote === null ? (
          <>
            <p className="text-sm text-fg-muted">
              We will show you exactly what comes back before anything is cancelled.
            </p>
            <Button variant="outline" onClick={() => void loadQuote()} disabled={pending} className="self-start">
              {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
              See what I would get back
            </Button>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-2 rounded-md border border-line bg-surface-2 px-4 py-3.5">
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-sm text-fg-muted">You would get back</span>
                <span className="text-xl font-semibold tabular">
                  {formatAmount(quote.refundAmount ?? 0, quote.currency ?? "")}
                </span>
              </div>
              {Number(quote.fee ?? 0) > 0 && (
                <div className="flex items-baseline justify-between gap-4 text-sm text-fg-muted">
                  <span>Cancellation fee</span>
                  <span className="tabular">
                    {formatAmount(quote.fee ?? 0, quote.currency ?? "")}
                  </span>
                </div>
              )}
              <p className="mt-1 flex items-start gap-2 text-xs text-fg-muted">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                {quote.reason}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => void confirmCancel()}
                disabled={pending}
                className="border-crit text-crit hover:bg-crit-soft"
              >
                {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
                Cancel this booking
              </Button>
              <Button variant="ghost" onClick={() => setQuote(null)} disabled={pending}>
                Keep it
              </Button>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}
