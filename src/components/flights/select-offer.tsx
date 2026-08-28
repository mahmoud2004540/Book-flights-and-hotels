"use client";

import { useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import type { FlightSearchInput } from "@/lib/validation/search";
import { Button } from "@/components/ui/button";

/**
 * Step 1 — starts a booking from a chosen offer.
 *
 * Only the offer id and the original search are sent. The server re-reads the
 * offer from its own cache, so a client cannot name its own price.
 */
export function SelectOfferButton({
  offerId,
  search,
}: {
  offerId: string;
  search: FlightSearchInput;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function select() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/booking/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offerId, search }),
      });
      const body = (await response.json()) as { ok?: boolean; draftId?: string };

      if (body.ok && body.draftId) {
        router.push(`/booking/${body.draftId}`);
        return;
      }
      setError("That fare is no longer available. Search again.");
    } catch {
      setError("We could not reach the server.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="md" onClick={() => void select()} disabled={pending}>
        {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
        Select
        <ArrowRight aria-hidden="true" />
      </Button>
      {error && <p className="max-w-[12rem] text-right text-xs text-crit">{error}</p>}
    </div>
  );
}
