import test from "node:test";
import assert from "node:assert/strict";
import { normalizeFlightOffers, normalizePlaces } from "./normalize";
import { offerRequestResponseSchema } from "./schemas";

/**
 * A Duffel offer-request response, in the documented v2 shape.
 *
 * This adapter was written without a live key, so the fixture is the contract:
 * these tests say what the adapter believes Duffel sends and what it turns that
 * into. If the real API differs, the schema fails the parse loudly rather than
 * mis-reading a price — and this file is where the correction belongs.
 */
const RESPONSE = {
  data: {
    id: "orq_0000AaBbCc",
    offers: [
      {
        id: "off_0000AaBbCc",
        total_amount: "412.55",
        total_currency: "USD",
        base_amount: "350.00",
        tax_amount: "62.55",
        expires_at: "2026-12-05T10:30:00Z",
        owner: { iata_code: "MS", name: "EgyptAir" },
        conditions: {
          refund_before_departure: { allowed: true, penalty_amount: "40.00" },
        },
        slices: [
          {
            duration: "PT5H20M",
            segments: [
              {
                origin: { iata_code: "CAI", name: "Cairo International" },
                destination: { iata_code: "IST", name: "Istanbul" },
                origin_terminal: "3",
                destination_terminal: null,
                departing_at: "2026-12-05T20:00:00",
                arriving_at: "2026-12-05T23:05:00",
                duration: "PT2H5M",
                marketing_carrier: { iata_code: "MS", name: "EgyptAir" },
                marketing_carrier_flight_number: "737",
                aircraft: { name: "Boeing 737" },
                passengers: [
                  { baggages: [{ type: "checked", quantity: 2 }, { type: "carry_on", quantity: 1 }] },
                ],
              },
              {
                origin: { iata_code: "IST", name: "Istanbul" },
                destination: { iata_code: "DXB", name: "Dubai" },
                origin_terminal: null,
                destination_terminal: "1",
                departing_at: "2026-12-06T01:00:00",
                arriving_at: "2026-12-06T06:20:00",
                duration: "PT4H20M",
                marketing_carrier: { iata_code: "MS", name: "EgyptAir" },
                marketing_carrier_flight_number: "738",
                aircraft: { name: "Airbus A320" },
                // One checked bag on this leg, two on the last: the trip
                // allowance is the smaller.
                passengers: [
                  { baggages: [{ type: "checked", quantity: 1 }, { type: "carry_on", quantity: 1 }] },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
};

function offersFrom(response: unknown) {
  const parsed = offerRequestResponseSchema.safeParse(response);
  assert.ok(parsed.success, "the fixture must satisfy the schema");
  return normalizeFlightOffers(parsed.data.data.offers, 600_000);
}

test("a documented Duffel response parses", () => {
  assert.equal(offerRequestResponseSchema.safeParse(RESPONSE).success, true);
});

test("the price is carried across as a string, to the cent", () => {
  const [offer] = offersFrom(RESPONSE);
  assert.equal(offer?.netPrice.amount, "412.55");
  assert.equal(offer?.netPrice.currency, "USD");
  assert.equal(offer?.fareBreakdown.base, "350.00");
  assert.equal(offer?.fareBreakdown.taxesAndFees, "62.55");
});

test("the offer keeps Duffel's own reference, for re-pricing", () => {
  const [offer] = offersFrom(RESPONSE);
  assert.equal(offer?.supplierOfferRef, "off_0000AaBbCc");
  assert.equal(offer?.supplierId, "duffel");
  assert.deepEqual(offer?.supplierPayload, { offerId: "off_0000AaBbCc" });
});

test("segments become one itinerary with the right stop count", () => {
  const [offer] = offersFrom(RESPONSE);
  assert.equal(offer?.itineraries.length, 1);
  assert.equal(offer?.itineraries[0]?.segments.length, 2);
  assert.equal(offer?.itineraries[0]?.stops, 1, "two segments is one stop");
  assert.equal(offer?.itineraries[0]?.durationMinutes, 320, "PT5H20M");
});

test("the flight number is carrier-prefixed, as the rest of the app expects", () => {
  const [offer] = offersFrom(RESPONSE);
  assert.equal(offer?.itineraries[0]?.segments[0]?.flightNumber, "MS737");
  assert.equal(offer?.itineraries[0]?.segments[0]?.carrierName, "EgyptAir");
  assert.equal(offer?.itineraries[0]?.segments[0]?.from.code, "CAI");
  assert.equal(offer?.itineraries[0]?.segments[0]?.from.terminal, "3");
  assert.equal(offer?.itineraries[0]?.segments[1]?.to.code, "DXB");
});

test("the baggage allowance is the smallest any leg grants", () => {
  const [offer] = offersFrom(RESPONSE);
  assert.equal(offer?.baggage.checkedBags, 1, "one leg allows one bag, so the trip allows one");
  assert.equal(offer?.baggage.cabinBags, 1);
});

test("refundable follows Duffel's own flag, not the penalty", () => {
  const [offer] = offersFrom(RESPONSE);
  assert.equal(offer?.refundable, true);

  const nonRefundable = structuredClone(RESPONSE);
  nonRefundable.data.offers[0]!.conditions.refund_before_departure.allowed = false;
  assert.equal(offersFrom(nonRefundable)[0]?.refundable, false);
});

test("a seat count Duffel does not publish stays null rather than guessed", () => {
  const [offer] = offersFrom(RESPONSE);
  assert.equal(offer?.seatsRemaining, null);
});

test("Duffel's own expiry wins over our fallback", () => {
  const [offer] = offersFrom(RESPONSE);
  assert.equal(offer?.expiresAt, "2026-12-05T10:30:00Z");
});

test("an offer in a currency we do not sell is dropped, never converted", () => {
  const foreign = structuredClone(RESPONSE);
  foreign.data.offers[0]!.total_currency = "JPY";
  assert.equal(offersFrom(foreign).length, 0);
});

test("a missing base amount does not invent a split", () => {
  const noBase = structuredClone(RESPONSE) as Record<string, never> & typeof RESPONSE;
  delete (noBase.data.offers[0] as Record<string, unknown>).base_amount;
  delete (noBase.data.offers[0] as Record<string, unknown>).tax_amount;
  const [offer] = offersFrom(noBase);
  assert.equal(offer?.fareBreakdown.base, "412.55");
  assert.equal(offer?.fareBreakdown.taxesAndFees, "0.00");
  assert.equal(offer?.fareBreakdown.total, "412.55");
});

test("a segment with no duration is measured from its timestamps", () => {
  const noDuration = structuredClone(RESPONSE);
  delete (noDuration.data.offers[0]!.slices[0] as Record<string, unknown>).duration;
  delete (noDuration.data.offers[0]!.slices[0]!.segments[0] as Record<string, unknown>).duration;
  const [offer] = offersFrom(noDuration);
  assert.equal(offer?.itineraries[0]?.segments[0]?.durationMinutes, 185, "20:00 to 23:05");
  assert.equal(offer?.itineraries[0]?.durationMinutes, 620, "20:00 to 06:20 next day");
});

test("a search that found nothing is a valid answer, not a malformed one", () => {
  // Duffel returns a request with no offers when there is no availability.
  // Rejecting that would turn an empty route into a supplier outage.
  assert.equal(offerRequestResponseSchema.safeParse({ data: { id: "orq_x" } }).success, true);
  assert.equal(offerRequestResponseSchema.safeParse({ data: { id: "orq_x", offers: [] } }).success, true);
});

test("a response that is not the documented shape is refused, not guessed at", () => {
  // The one that matters: a number where money should be a string, which is
  // exactly how a cent gets lost.
  const numericAmount = structuredClone(RESPONSE);
  (numericAmount.data.offers[0] as Record<string, unknown>).total_amount = 412.55;
  assert.equal(offerRequestResponseSchema.safeParse(numericAmount).success, false);

  const noSlices = structuredClone(RESPONSE);
  noSlices.data.offers[0]!.slices = [];
  assert.equal(offerRequestResponseSchema.safeParse(noSlices).success, false, "an offer with no slices is not a flight");

  const noSegments = structuredClone(RESPONSE);
  noSegments.data.offers[0]!.slices[0]!.segments = [];
  assert.equal(offerRequestResponseSchema.safeParse(noSegments).success, false);

  assert.equal(offerRequestResponseSchema.safeParse({ offers: [] }).success, false, "the envelope is required");
});

test("place suggestions keep only the kind that was asked for", () => {
  const raw = {
    data: [
      { id: "arp_cai", name: "Cairo International", iata_code: "CAI", type: "airport", city_name: "Cairo", iata_country_code: "EG" },
      { id: "cit_cai", name: "Cairo", iata_code: "CAI", type: "city", iata_country_code: "EG" },
      { id: "arp_none", name: "No code", iata_code: null, type: "airport" },
    ],
  };

  assert.deepEqual(normalizePlaces(raw, "airport").map((p) => p.name), ["Cairo International"]);
  assert.deepEqual(normalizePlaces(raw, "city").map((p) => p.name), ["Cairo"]);
  assert.equal(normalizePlaces(raw, "any").length, 2, "a place with no IATA code is unusable");
});

test("an unparseable suggestions response yields nothing rather than throwing", () => {
  assert.deepEqual(normalizePlaces({ nope: true }, "any"), []);
});
