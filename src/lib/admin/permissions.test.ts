import test from "node:test";
import assert from "node:assert/strict";
import { CAPABILITIES, can, capabilitiesOf, isStaff } from "./permissions";

test("a traveller is not staff and can do nothing in the admin area", () => {
  assert.equal(isStaff("USER"), false);
  for (const capability of CAPABILITIES) {
    assert.equal(can("USER", capability), false, capability);
  }
});

test("every staff role can open the admin area", () => {
  for (const role of ["SUPPORT", "FINANCE", "SUPER_ADMIN"] as const) {
    assert.equal(isStaff(role), true, role);
  }
});

test("support sees bookings but never money", () => {
  assert.equal(can("SUPPORT", "bookings.read"), true);
  assert.equal(can("SUPPORT", "bookings.cancel"), true);
  assert.equal(can("SUPPORT", "revenue.read"), false);
  assert.equal(can("SUPPORT", "markup.write"), false);
  // The markup is the margin — the same figure the traveller is never shown.
  assert.equal(can("SUPPORT", "markup.read"), false);
});

test("finance owns pricing and revenue but not the platform", () => {
  assert.equal(can("FINANCE", "revenue.read"), true);
  assert.equal(can("FINANCE", "markup.write"), true);
  assert.equal(can("FINANCE", "suppliers.write"), false);
});

test("only a super admin can grant a role, so no one can promote themselves", () => {
  assert.equal(can("SUPER_ADMIN", "users.role"), true);
  assert.equal(can("FINANCE", "users.role"), false);
  assert.equal(can("SUPPORT", "users.role"), false);
});

test("the ladder only ever widens", () => {
  const support = capabilitiesOf("SUPPORT");
  const finance = capabilitiesOf("FINANCE");
  const superAdmin = capabilitiesOf("SUPER_ADMIN");

  for (const capability of support) {
    assert.ok(finance.includes(capability), `FINANCE is missing ${capability}`);
  }
  for (const capability of finance) {
    assert.ok(superAdmin.includes(capability), `SUPER_ADMIN is missing ${capability}`);
  }
});

test("a super admin holds every capability there is", () => {
  assert.deepEqual([...capabilitiesOf("SUPER_ADMIN")].sort(), [...CAPABILITIES].sort());
});
