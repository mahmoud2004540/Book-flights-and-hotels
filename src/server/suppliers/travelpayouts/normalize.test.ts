import test from "node:test";
import assert from "node:assert/strict";
import { normalizeIndexedFares } from "./normalize";
import { pricesForDatesSchema } from "./schemas";

/** A prices-for-dates response in Travelpayouts' documented v3 shape. */
const RESPONSE = {
  success: true,
  currency: "usd",
  data: [
    {
      origin: "CAI",
      destination: "DXB",
      origin_airport: "CAI",
      destination_airport: "DXB",
      price: 189,
      airline: "FZ",
      flight_number: 1234,
      departure_at: "2026-12-05T20:00:00Z",
      transfers: 0,
      duration: 215,
      duration_to: 215,
      link: "/search/CAI0512DXB1?t=abc",
    },
    {
      origin: "CAI",
      destination: "DXB",
      price: 240.5,
      airline: "MS",
      flight_number: "737",
      departure_at: "2026-12-05T10:00:00Z",
      transfers: 1,
      duration_to: 480,
      link: null,
    },
  ],
};

// No default for the marker: a default would swallow an explicit undefined,
// and "no marker configured" is one of the cases being tested.
function offersFrom(raw: unknown, marker: string | undefined) {
  const parsed = pricesForDatesSchema.safeParse(raw);
  assert.ok(parsed.success, "the fixture must satisfy the schema");
  return normalizeIndexedFares(parsed.data, "USD", marker, 600_000);
}
const withMarker = (raw: unknown) => offersFrom(raw, "12345");

test("every offer from a price index is marked unbookable", () => {
  const offers = withMarker(RESPONSE);
  assert.equal(offers.length, 2);
  assert.ok(offers.every((offer) => offer.bookable === false));
});

test("the price becomes a fixed decimal string, never a float", () => {
  const [cheap, dearer] = withMarker(RESPONSE);
  assert.equal(cheap?.netPrice.amount, "189.00");
  assert.equal(dearer?.netPrice.amount, "240.50");
  assert.equal(typeof cheap?.netPrice.amount, "string");
});

test("no fare breakdown is invented from a single published number", () => {
  const [offer] = withMarker(RESPONSE);
  assert.equal(offer?.fareBreakdown.base, "189.00");
  assert.equal(offer?.fareBreakdown.taxesAndFees, "0.00", "a guessed tax split beside real ones would be a lie");
  assert.equal(offer?.fareBreakdown.total, "189.00");
});

test("the link out carries our marker", () => {
  const [offer] = withMarker(RESPONSE);
  assert.ok(offer?.bookingUrl?.startsWith("https://www.aviasales.com/search/CAI0512DXB1?t=abc"));
  assert.ok(offer?.bookingUrl?.includes("marker=12345"));
  assert.ok(offer?.bookingUrl?.includes("&marker="), "the path already had a query string");
});

test("no marker configured still produces a usable link", () => {
  const [offer] = offersFrom(RESPONSE, undefined);
  assert.equal(offer?.bookingUrl, "https://www.aviasales.com/search/CAI0512DXB1?t=abc");
});

test("a row with no link has nowhere to send anyone", () => {
  const [, offer] = withMarker(RESPONSE);
  assert.equal(offer?.bookingUrl, null);
  assert.equal(offer?.bookable, false);
});

test("the stop count is truthful even though there is one segment to show", () => {
  const [direct, connecting] = withMarker(RESPONSE);
  assert.equal(direct?.itineraries[0]?.stops, 0);
  assert.equal(direct?.itineraries[0]?.segments.length, 1);
  // The row knows there is a transfer but not where; claiming direct is the
  // one lie that would actually mislead someone booking.
  assert.equal(connecting?.itineraries[0]?.stops, 1);
  assert.equal(connecting?.itineraries[0]?.segments.length, 1);
});

test("arrival is derived from the published duration", () => {
  const [offer] = withMarker(RESPONSE);
  assert.equal(offer?.itineraries[0]?.segments[0]?.from.at, "2026-12-05T20:00:00Z");
  assert.equal(offer?.itineraries[0]?.segments[0]?.to.at, "2026-12-05T23:35:00.000Z", "215 minutes on");
  assert.equal(offer?.itineraries[0]?.durationMinutes, 215);
});

test("the flight number is carrier-prefixed whether it arrived as text or a number", () => {
  const [numeric, text] = withMarker(RESPONSE);
  assert.equal(numeric?.itineraries[0]?.segments[0]?.flightNumber, "FZ1234");
  assert.equal(text?.itineraries[0]?.segments[0]?.flightNumber, "MS737");
});

test("what the index does not know stays unknown rather than assumed", () => {
  const [offer] = withMarker(RESPONSE);
  assert.equal(offer?.baggage.checkedBags, null);
  assert.equal(offer?.baggage.cabinBags, null);
  assert.equal(offer?.seatsRemaining, null);
  assert.equal(offer?.refundable, false, "unknown conditions must not read as refundable");
});

test("a zero or negative price is dropped rather than shown as free", () => {
  const broken = structuredClone(RESPONSE);
  broken.data[0]!.price = 0;
  assert.equal(withMarker(broken).length, 1);
});

test("a currency we do not sell falls back to the one that was asked for", () => {
  const foreign = structuredClone(RESPONSE);
  foreign.currency = "jpy";
  const [offer] = withMarker(foreign);
  assert.equal(offer?.netPrice.currency, "USD");
});

test("a response the API marks unsuccessful still parses, so the adapter can refuse it", () => {
  const failed = pricesForDatesSchema.safeParse({ success: false, data: [] });
  assert.equal(failed.success, true);
  assert.equal(failed.success && failed.data.success, false);
});

test("a price sent as a string is refused — that is how a number becomes text and back", () => {
  const stringPrice = structuredClone(RESPONSE) as unknown as typeof RESPONSE;
  (stringPrice.data[0] as Record<string, unknown>).price = "189";
  assert.equal(pricesForDatesSchema.safeParse(stringPrice).success, false);
});
