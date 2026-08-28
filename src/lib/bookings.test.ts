import test from "node:test";
import assert from "node:assert/strict";
import { bucketOf } from "./bookings";

const NOW = new Date("2026-08-28T12:00:00Z");
const future = new Date("2026-12-05T20:00:00Z");
const past = new Date("2026-01-05T20:00:00Z");

test("a confirmed trip is upcoming until its departure passes", () => {
  assert.equal(bucketOf({ status: "CONFIRMED", departureAt: future, now: NOW }), "upcoming");
  assert.equal(bucketOf({ status: "CONFIRMED", departureAt: past, now: NOW }), "past");
});

test("a trip departing exactly now still counts as upcoming", () => {
  assert.equal(bucketOf({ status: "CONFIRMED", departureAt: NOW, now: NOW }), "upcoming");
});

test("a cancelled trip is never upcoming, however far off the departure was", () => {
  for (const status of ["CANCELLED", "REFUNDED", "FAILED"] as const) {
    assert.equal(bucketOf({ status, departureAt: future, now: NOW }), "cancelled", status);
    assert.equal(bucketOf({ status, departureAt: past, now: NOW }), "cancelled", status);
  }
});

test("a booking still being paid for is upcoming, where the traveller will look", () => {
  assert.equal(bucketOf({ status: "PENDING", departureAt: null, now: NOW }), "upcoming");
});
