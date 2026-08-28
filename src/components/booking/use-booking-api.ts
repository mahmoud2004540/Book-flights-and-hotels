"use client";

import { useCallback, useMemo, useState } from "react";
import type { Extras } from "@/lib/booking-types";
import type { Money } from "@/server/suppliers/types";
import type { PassengerInput } from "@/lib/validation/booking";
import type { PassengerIssue } from "./passenger-form";

export type PriceResult = {
  quoted: Money;
  confirmed: Money;
  changed: boolean;
  accepted: boolean;
};

type PriceOutcome =
  | { ok: true; value: PriceResult }
  | { ok: false; message: string };

type SaveOutcome =
  | { ok: true }
  | { ok: false; message: string; issues: PassengerIssue[] };

/** Maps a server refusal reason to something the traveller can act on. */
function reasonMessage(reason: string | undefined): string {
  switch (reason) {
    case "expired":
      return "Your held price has expired. Search again to see the current fare.";
    case "sold_out":
      return "The airline has just sold out of this fare. Try another flight.";
    case "supplier_unavailable":
    case "supplier_error":
      return "We could not reach the airline. Try again in a moment.";
    case "price_not_accepted":
      return "Accept the new price before continuing.";
    case "no_passengers":
      return "Add traveller details before continuing.";
    case "email_required":
      return "Add an email address so we can send the confirmation.";
    default:
      return "Something went wrong. Try again.";
  }
}

/** All the booking calls in one place, with a shared pending flag. */
export function useBookingApi(draftId: string) {
  const [pending, setPending] = useState(false);

  const post = useCallback(
    async (path: string, body?: unknown): Promise<{ status: number; data: unknown }> => {
      setPending(true);
      try {
        const response = await fetch(`/api/booking/${draftId}${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        return { status: response.status, data: await response.json().catch(() => null) };
      } finally {
        setPending(false);
      }
    },
    [draftId],
  );

  const confirmPrice = useCallback(async (): Promise<PriceOutcome> => {
    const { data } = await post("/price");
    const body = data as {
      ok?: boolean;
      reason?: string;
      quotedPrice?: Money;
      confirmedPrice?: Money;
      changed?: boolean;
    } | null;

    if (!body?.ok || !body.quotedPrice || !body.confirmedPrice) {
      return { ok: false, message: reasonMessage(body?.reason) };
    }

    return {
      ok: true,
      value: {
        quoted: body.quotedPrice,
        confirmed: body.confirmedPrice,
        changed: body.changed ?? false,
        accepted: !(body.changed ?? false),
      },
    };
  }, [post]);

  const acceptPrice = useCallback(async (): Promise<boolean> => {
    const { data } = await post("/price/accept");
    return (data as { ok?: boolean } | null)?.ok === true;
  }, [post]);

  const savePassengers = useCallback(
    async (passengers: PassengerInput[], departDate: string): Promise<SaveOutcome> => {
      const { data } = await post("/passengers", { passengers, departDate });
      const body = data as {
        ok?: boolean;
        reason?: string;
        issues?: PassengerIssue[];
        fieldErrors?: Record<string, string>;
      } | null;

      if (body?.ok) return { ok: true };

      if (body?.issues && body.issues.length > 0) {
        return {
          ok: false,
          message: "Some traveller details need fixing.",
          issues: body.issues,
        };
      }
      if (body?.fieldErrors) {
        return {
          ok: false,
          message: "Fill in every traveller field.",
          issues: [],
        };
      }
      return { ok: false, message: reasonMessage(body?.reason), issues: [] };
    },
    [post],
  );

  const saveExtras = useCallback(
    async (extras: Extras): Promise<SaveOutcome> => {
      const { data } = await post("/extras", extras);
      const body = data as { ok?: boolean; reason?: string } | null;
      return body?.ok
        ? { ok: true }
        : { ok: false, message: reasonMessage(body?.reason), issues: [] };
    },
    [post],
  );

  const confirmBooking = useCallback(
    async (
      idempotencyKey: string,
      guestEmail?: string,
    ): Promise<{ ok: true; reference: string } | { ok: false; message: string }> => {
      const { data } = await post("/confirm", {
        idempotencyKey,
        acceptedTerms: true,
        guestEmail,
      });
      const body = data as { ok?: boolean; reason?: string; reference?: string } | null;

      return body?.ok && body.reference
        ? { ok: true, reference: body.reference }
        : { ok: false, message: reasonMessage(body?.reason) };
    },
    [post],
  );

  return useMemo(
    () => ({ pending, confirmPrice, acceptPrice, savePassengers, saveExtras, confirmBooking }),
    [pending, confirmPrice, acceptPrice, savePassengers, saveExtras, confirmBooking],
  );
}
