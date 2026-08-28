import { randomUUID } from "node:crypto";
import { BOOKING_SESSION_MINUTES } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import type { NormalizedFlightOffer, Money } from "@/server/suppliers/types";
import { extrasTotal, type Extras, type Passenger } from "@/lib/booking-types";

/**
 * The in-progress booking, held server-side for the length of the session.
 *
 * Stored in offers_cache rather than in a table of its own: a draft is
 * short-lived cached state with the same shape and lifetime as everything else
 * in there, and the expiry sweep already covers it. Abandoned drafts therefore
 * never reach the bookings table, which stays a record of real bookings.
 */

export type { Extras, Passenger };
export { extrasTotal };

export type BookingDraft = {
  id: string;
  createdAt: string;
  expiresAt: string;
  /** The offer as searched, including the supplier payload re-pricing needs. */
  offer: NormalizedFlightOffer;
  /** What the traveller was shown at search time, markup included. */
  quotedPrice: Money;
  /** Set once step 2 has run. Until then, payment cannot be reached. */
  confirmedPrice: Money | null;
  priceChanged: boolean;
  priceAccepted: boolean;
  passengers: Passenger[];
  extras: Extras;
};

const KEY_PREFIX = "draft:";

function key(id: string): string {
  return `${KEY_PREFIX}${id}`;
}

export async function createDraft(
  offer: NormalizedFlightOffer,
  quotedPrice: Money,
): Promise<BookingDraft> {
  const now = Date.now();
  const draft: BookingDraft = {
    id: randomUUID(),
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + BOOKING_SESSION_MINUTES * 60_000).toISOString(),
    offer,
    quotedPrice,
    confirmedPrice: null,
    priceChanged: false,
    priceAccepted: false,
    passengers: [],
    extras: { extraBags: 0, seatSelection: false, travelInsurance: false },
  };

  await prisma.offersCache.create({
    data: {
      cacheKey: key(draft.id),
      supplierId: offer.supplierId,
      payload: draft as unknown as object,
      expiresAt: new Date(draft.expiresAt),
    },
  });

  return draft;
}

export async function readDraft(id: string): Promise<BookingDraft | null> {
  const row = await prisma.offersCache.findUnique({ where: { cacheKey: key(id) } });
  if (!row) return null;

  // An expired draft is deleted rather than returned, so a stale checkout can
  // never be resumed against a price that is no longer quotable.
  if (row.expiresAt < new Date()) {
    await prisma.offersCache.delete({ where: { cacheKey: key(id) } }).catch(() => undefined);
    return null;
  }

  return row.payload as unknown as BookingDraft;
}

export async function saveDraft(draft: BookingDraft): Promise<void> {
  await prisma.offersCache.update({
    where: { cacheKey: key(draft.id) },
    data: { payload: draft as unknown as object },
  });
}

export async function discardDraft(id: string): Promise<void> {
  await prisma.offersCache.deleteMany({ where: { cacheKey: key(id) } });
}

/** The amount the traveller pays: the confirmed fare plus any extras. */
export function draftTotal(draft: BookingDraft): number {
  const fare = Number((draft.confirmedPrice ?? draft.quotedPrice).amount);
  return fare + extrasTotal(draft.extras, draft.passengers.length);
}
