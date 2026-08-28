import test from "node:test";
import assert from "node:assert/strict";
import { beats, byPriceThenSupplier, supplierRank } from "./ranking";

test("price decides before the supplier order ever comes into it", () => {
  // Travelpayouts ranks below Duffel, and still wins by being a cent cheaper.
  assert.ok(
    byPriceThenSupplier(
      { amount: "399.99", supplierId: "travelpayouts" },
      { amount: "400.00", supplierId: "duffel" },
    ) < 0,
  );
});

test("an exact tie goes to the supplier that issues the ticket through us", () => {
  const order = ["duffel", "amadeus", "travelpayouts", "bookingcom"] as const;
  for (let i = 0; i < order.length - 1; i++) {
    const better = order[i]!;
    const worse = order[i + 1]!;
    assert.ok(
      byPriceThenSupplier({ amount: "400.00", supplierId: better }, { amount: "400.00", supplierId: worse }) < 0,
      `${better} should beat ${worse} on a tie`,
    );
    assert.ok(supplierRank(better) < supplierRank(worse));
  }
});

test("the same supplier at the same price does not displace itself", () => {
  const offer = { amount: "400.00", supplierId: "duffel" } as const;
  assert.equal(byPriceThenSupplier(offer, offer), 0);
  assert.equal(beats(offer, offer), false);
});

test("a cheaper challenger always displaces the offer already held", () => {
  assert.equal(
    beats({ amount: "350.00", supplierId: "bookingcom" }, { amount: "400.00", supplierId: "duffel" }),
    true,
  );
});

test("an equal price displaces only when the challenger ranks higher", () => {
  assert.equal(
    beats({ amount: "400.00", supplierId: "duffel" }, { amount: "400.00", supplierId: "amadeus" }),
    true,
  );
  assert.equal(
    beats({ amount: "400.00", supplierId: "amadeus" }, { amount: "400.00", supplierId: "duffel" }),
    false,
  );
});

test("trailing zeros do not change the comparison", () => {
  assert.equal(
    byPriceThenSupplier(
      { amount: "400.0", supplierId: "duffel" },
      { amount: "400.00", supplierId: "duffel" },
    ),
    0,
  );
});

test("sorting a merged list puts the cheapest first and breaks ties in order", () => {
  const offers = [
    { amount: "400.00", supplierId: "travelpayouts" as const },
    { amount: "350.00", supplierId: "bookingcom" as const },
    { amount: "400.00", supplierId: "duffel" as const },
    { amount: "400.00", supplierId: "amadeus" as const },
  ];
  const sorted = [...offers].sort(byPriceThenSupplier).map((o) => o.supplierId);
  assert.deepEqual(sorted, ["bookingcom", "duffel", "amadeus", "travelpayouts"]);
});
