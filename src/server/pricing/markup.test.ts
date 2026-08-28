import test from "node:test";
import assert from "node:assert/strict";
import { rescaleFare } from "./markup";

const net = { base: "207.00", taxesAndFees: "37.00", total: "244.00" };

test("the rescaled breakdown totals what the traveller is charged, not our cost", () => {
  const fare = rescaleFare(net, "254.98");
  assert.equal(fare.total, "254.98");
  assert.notEqual(fare.total, net.total);
});

test("the lines always add up to the total exactly", () => {
  for (const charged of ["254.98", "300.00", "244.01", "999.99", "1.00"]) {
    const fare = rescaleFare(net, charged);
    assert.equal(
      (Number(fare.base) + Number(fare.taxesAndFees)).toFixed(2),
      Number(charged).toFixed(2),
      `lines must sum to ${charged}`,
    );
  }
});

test("the supplier's own proportion of base to taxes is preserved", () => {
  const fare = rescaleFare(net, "488.00"); // exactly double
  assert.equal(fare.base, "414.00");
  assert.equal(fare.taxesAndFees, "74.00");
});

test("the net figures never survive into the rescaled breakdown", () => {
  const fare = rescaleFare(net, "254.98");
  assert.notEqual(fare.base, net.base);
  assert.notEqual(fare.taxesAndFees, net.taxesAndFees);
});

test("a zero or unparseable net charges the whole amount as base rather than dividing by zero", () => {
  for (const broken of [
    { base: "0.00", taxesAndFees: "0.00", total: "0.00" },
    { base: "1.00", taxesAndFees: "0.00", total: "not a number" },
  ]) {
    const fare = rescaleFare(broken, "254.98");
    assert.equal(fare.total, "254.98");
    assert.equal(fare.base, "254.98");
    assert.equal(fare.taxesAndFees, "0.00");
  }
});

test("an all-taxes fare stays all taxes", () => {
  const fare = rescaleFare({ base: "0.00", taxesAndFees: "50.00", total: "50.00" }, "52.25");
  assert.equal(fare.base, "0.00");
  assert.equal(fare.taxesAndFees, "52.25");
});
