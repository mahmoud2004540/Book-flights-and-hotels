import test from "node:test";
import assert from "node:assert/strict";
import { canBlock, canChangeRole } from "./user-rules";

const base = {
  actorId: "admin-1",
  actorRole: "SUPER_ADMIN",
  targetId: "user-2",
  targetRole: "USER",
  nextRole: "SUPPORT",
  superAdminCount: 2,
} as const;

test("a super admin can promote someone else", () => {
  assert.equal(canChangeRole({ ...base }).allowed, true);
});

test("nobody below super admin can change a role", () => {
  for (const actorRole of ["USER", "SUPPORT", "FINANCE"] as const) {
    const decision = canChangeRole({ ...base, actorRole });
    assert.equal(decision.allowed, false, actorRole);
  }
});

test("you cannot change your own role, even as a super admin", () => {
  const decision = canChangeRole({ ...base, targetId: base.actorId, targetRole: "SUPER_ADMIN" });
  assert.equal(decision.allowed, false);
  assert.match(decision.allowed ? "" : decision.reason, /your own role/);
});

test("the last super admin cannot be demoted", () => {
  const decision = canChangeRole({
    ...base,
    targetRole: "SUPER_ADMIN",
    nextRole: "FINANCE",
    superAdminCount: 1,
  });
  assert.equal(decision.allowed, false);
  assert.match(decision.allowed ? "" : decision.reason, /last super admin/);
});

test("a super admin can be demoted while another one exists", () => {
  assert.equal(
    canChangeRole({ ...base, targetRole: "SUPER_ADMIN", nextRole: "FINANCE", superAdminCount: 2 })
      .allowed,
    true,
  );
});

test("promoting the only super admin to super admin is refused as a no-op, not as a lockout", () => {
  const decision = canChangeRole({
    ...base,
    targetRole: "SUPER_ADMIN",
    nextRole: "SUPER_ADMIN",
    superAdminCount: 1,
  });
  assert.equal(decision.allowed, false);
  assert.match(decision.allowed ? "" : decision.reason, /already their role/);
});

test("you cannot block yourself", () => {
  const decision = canBlock({
    actorId: "admin-1",
    targetId: "admin-1",
    targetRole: "SUPER_ADMIN",
    blocked: true,
    superAdminCount: 3,
  });
  assert.equal(decision.allowed, false);
  assert.match(decision.allowed ? "" : decision.reason, /your own account/);
});

test("blocking the last super admin is refused, unblocking them is not", () => {
  const target = {
    actorId: "admin-1",
    targetId: "admin-2",
    targetRole: "SUPER_ADMIN",
    superAdminCount: 1,
  } as const;
  assert.equal(canBlock({ ...target, blocked: true }).allowed, false);
  assert.equal(canBlock({ ...target, blocked: false }).allowed, true);
});

test("an ordinary traveller can always be blocked", () => {
  assert.equal(
    canBlock({
      actorId: "admin-1",
      targetId: "user-9",
      targetRole: "USER",
      blocked: true,
      superAdminCount: 1,
    }).allowed,
    true,
  );
});
