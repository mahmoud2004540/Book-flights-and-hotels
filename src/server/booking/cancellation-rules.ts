import { BookingStatus } from "@prisma/client";

/**
 * What a traveller gets back if they cancel — section 4.6.
 *
 * These are our own default terms, applied where the supplier has not given
 * per-fare rules. They are deliberately conservative and stated in full before
 * anyone confirms, because a refund figure discovered after cancelling is the
 * fastest way to lose someone's trust. Under a merchant-of-record agreement
 * the supplier's own terms replace this table.
 */

/** Kept flat and visible rather than a percentage, so the quote is predictable. */
export const CANCELLATION_FEE = 25;

/** Inside this window an airline seat is effectively spent, so nothing comes back. */
export const NO_REFUND_HOURS = 24;

export type CancellationQuote =
  | {
      allowed: true;
      refundAmount: string;
      fee: string;
      currency: string;
      reason: string;
    }
  | { allowed: false; reason: string };

type QuoteInput = {
  status: BookingStatus;
  totalAmount: number;
  currency: string;
  refundableFare: boolean;
  departureAt: Date | null;
  now: Date;
};

/** Pure, so the rules can be tested without a database. */
export function quoteCancellation(input: QuoteInput): CancellationQuote {
  if (input.status === BookingStatus.CANCELLED) {
    return { allowed: false, reason: "This booking is already cancelled." };
  }
  if (input.status === BookingStatus.REFUNDED) {
    return { allowed: false, reason: "This booking was already refunded." };
  }
  if (input.status !== BookingStatus.CONFIRMED) {
    return { allowed: false, reason: "Only a confirmed booking can be cancelled." };
  }

  if (input.departureAt !== null) {
    const hoursToDeparture =
      (input.departureAt.getTime() - input.now.getTime()) / 3_600_000;

    if (hoursToDeparture < 0) {
      return { allowed: false, reason: "This trip has already departed." };
    }
    if (hoursToDeparture < NO_REFUND_HOURS) {
      return {
        allowed: true,
        refundAmount: "0.00",
        fee: "0.00",
        currency: input.currency,
        reason: `Cancelling within ${NO_REFUND_HOURS} hours of departure carries no refund. You can still cancel, but nothing will be returned.`,
      };
    }
  }

  if (!input.refundableFare) {
    return {
      allowed: true,
      refundAmount: "0.00",
      fee: "0.00",
      currency: input.currency,
      reason:
        "This fare is non-refundable, so cancelling returns nothing. You can still cancel to release the seat.",
    };
  }

  const refund = Math.max(0, input.totalAmount - CANCELLATION_FEE);
  return {
    allowed: true,
    refundAmount: refund.toFixed(2),
    fee: CANCELLATION_FEE.toFixed(2),
    currency: input.currency,
    reason: `This fare is refundable. A ${input.currency} ${CANCELLATION_FEE} cancellation fee applies.`,
  };
}

type StoredItinerary = { segments: Array<{ from: { at: string } }> };

/** The first departure time, read back from the stored itinerary. */
export function departureOf(details: unknown): Date | null {
  const itineraries = (details as { itineraries?: StoredItinerary[] } | null)?.itineraries;
  const at = itineraries?.[0]?.segments?.[0]?.from.at;
  if (!at) return null;

  const date = new Date(at);
  return Number.isNaN(date.getTime()) ? null : date;
}
