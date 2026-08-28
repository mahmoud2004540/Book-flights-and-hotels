import test from "node:test";
import assert from "node:assert/strict";
import {
  CANCELLATION_FEE,
  NO_REFUND_HOURS,
  departureOf,
  quoteCancellation,
} from "./cancellation-rules";

const NOW = new Date("2026-08-28T12:00:00Z");
const hoursFromNow = (h: number) => new Date(NOW.getTime() + h * 3_600_000);

const base = {
  totalAmount: 400,
  currency: "USD",
  refundableFare: true,
  departureAt: hoursFromNow(72),
  now: NOW,
} as const;

test("a confirmed refundable booking gets the total back less the fee", () => {
  const quote = quoteCancellation({ ...base, status: "CONFIRMED" });
  assert.equal(quote.allowed, true);
  assert.equal(quote.allowed && quote.refundAmount, "375.00");
  assert.equal(quote.allowed && quote.fee, CANCELLATION_FEE.toFixed(2));
  assert.equal(quote.allowed && quote.currency, "USD");
});

test("the refund never goes negative when the fare is worth less than the fee", () => {
  const quote = quoteCancellation({ ...base, status: "CONFIRMED", totalAmount: 10 });
  assert.equal(quote.allowed && quote.refundAmount, "0.00");
});

test("an already cancelled or refunded booking cannot be cancelled again", () => {
  for (const status of ["CANCELLED", "REFUNDED"] as const) {
    const quote = quoteCancellation({ ...base, status });
    assert.equal(quote.allowed, false, status);
    assert.match(quote.reason, /already/);
  }
});

test("a booking that never reached confirmation cannot be cancelled", () => {
  for (const status of ["PENDING", "FAILED"] as const) {
    assert.equal(quoteCancellation({ ...base, status }).allowed, false, status);
  }
});

test("a departed trip cannot be cancelled", () => {
  const quote = quoteCancellation({
    ...base,
    status: "CONFIRMED",
    departureAt: hoursFromNow(-1),
  });
  assert.equal(quote.allowed, false);
  assert.match(quote.reason, /already departed/);
});

test("inside the no-refund window it can still be cancelled, but for nothing", () => {
  const quote = quoteCancellation({
    ...base,
    status: "CONFIRMED",
    departureAt: hoursFromNow(NO_REFUND_HOURS - 1),
  });
  assert.equal(quote.allowed, true);
  assert.equal(quote.allowed && quote.refundAmount, "0.00");
  assert.equal(quote.allowed && quote.fee, "0.00", "no fee is charged when nothing is returned");
});

test("the window boundary itself is still refundable", () => {
  const quote = quoteCancellation({
    ...base,
    status: "CONFIRMED",
    departureAt: hoursFromNow(NO_REFUND_HOURS),
  });
  assert.equal(quote.allowed && quote.refundAmount, "375.00");
});

test("a non-refundable fare returns nothing but can still be released", () => {
  const quote = quoteCancellation({ ...base, status: "CONFIRMED", refundableFare: false });
  assert.equal(quote.allowed, true);
  assert.equal(quote.allowed && quote.refundAmount, "0.00");
  assert.match(quote.allowed ? quote.reason : "", /non-refundable/);
});

test("a booking with no recorded departure is quoted on its fare rules alone", () => {
  const quote = quoteCancellation({ ...base, status: "CONFIRMED", departureAt: null });
  assert.equal(quote.allowed && quote.refundAmount, "375.00");
});

test("the departure is read from the first segment of the first itinerary", () => {
  const details = {
    itineraries: [
      { segments: [{ from: { at: "2026-12-05T20:00:00Z" } }, { from: { at: "2026-12-05T22:44:00Z" } }] },
      { segments: [{ from: { at: "2026-12-19T09:00:00Z" } }] },
    ],
  };
  assert.equal(departureOf(details)?.toISOString(), "2026-12-05T20:00:00.000Z");
});

test("a missing or unparseable departure reads as null rather than an invalid date", () => {
  assert.equal(departureOf(null), null);
  assert.equal(departureOf({}), null);
  assert.equal(departureOf({ itineraries: [] }), null);
  assert.equal(departureOf({ itineraries: [{ segments: [{ from: { at: "not a date" } }] }] }), null);
});
