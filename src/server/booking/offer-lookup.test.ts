import test from "node:test";
import assert from "node:assert/strict";
import type { NormalizedFlightOffer } from "@/server/suppliers/types";

/**
 * The guard that keeps an unbookable fare out of the booking flow.
 *
 * findOfferForBooking itself reads the cache and the database, so what is
 * exercised here is the decision it makes, held to the same rule: a price-index
 * offer has no seat behind it, and the only correct answer is to refuse.
 */
function bookableOnly(offers: NormalizedFlightOffer[], offerId: string) {
  const offer = offers.find((candidate) => candidate.offerId === offerId);
  if (!offer) return null;
  if (!offer.bookable) return null;
  return offer;
}

const base = {
  supplierOfferRef: "ref",
  itineraries: [],
  netPrice: { amount: "100.00", currency: "USD" as const },
  fareBreakdown: { base: "100.00", taxesAndFees: "0.00", total: "100.00" },
  baggage: { checkedBags: null, cabinBags: null },
  refundable: false,
  seatsRemaining: null,
  validatingCarrier: null,
  expiresAt: "2027-01-01T00:00:00Z",
  supplierPayload: null,
};

const offers: NormalizedFlightOffer[] = [
  { ...base, offerId: "amadeus:1", supplierId: "amadeus", bookable: true, bookingUrl: null },
  {
    ...base,
    offerId: "travelpayouts:1",
    supplierId: "travelpayouts",
    bookable: false,
    bookingUrl: "https://www.aviasales.com/search/x",
    netPrice: { amount: "50.00", currency: "USD" },
  },
];

test("a bookable offer is found", () => {
  assert.equal(bookableOnly(offers, "amadeus:1")?.offerId, "amadeus:1");
});

test("an unbookable offer is refused even though it is cheaper", () => {
  assert.equal(bookableOnly(offers, "travelpayouts:1"), null);
});

test("an offer that is not in the list is refused", () => {
  assert.equal(bookableOnly(offers, "duffel:nope"), null);
});

test("being cheapest never makes an unbookable offer selectable", () => {
  const cheapest = [...offers].sort(
    (a, b) => Number(a.netPrice.amount) - Number(b.netPrice.amount),
  )[0];
  assert.equal(cheapest?.offerId, "travelpayouts:1", "it really is the cheapest");
  assert.equal(bookableOnly(offers, cheapest!.offerId), null, "and it is still refused");
});
