import type { Role } from "@prisma/client";

/**
 * What each staff role may do — the "tiered permissions" of section 7.
 *
 * Capabilities rather than role checks: a page asks "may this person change a
 * markup rule", not "is this person FINANCE". Roles are then a table anyone can
 * read in one screen, and adding a role later touches this file only.
 *
 * Pure and free of server imports, so a client component can hide a control the
 * viewer cannot use. Hiding is not the guard — every route checks again.
 */

export const CAPABILITIES = [
  "bookings.read",
  "bookings.cancel",
  "users.read",
  "users.block",
  "users.role",
  "markup.read",
  "markup.write",
  "suppliers.read",
  "suppliers.write",
  "revenue.read",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

/**
 * The ladder, narrowest first.
 *
 * SUPPORT answers travellers: it can see bookings and accounts and cancel a
 * booking, but sees no revenue and touches no pricing.
 * FINANCE owns the money: everything SUPPORT sees, plus revenue and the markup
 * rules that produce it.
 * SUPER_ADMIN owns the platform: supplier activation, and the roles themselves.
 * Only it can grant a role, so no one can promote themselves.
 */
const GRANTS: Record<Role, readonly Capability[]> = {
  USER: [],
  // No markup.read: the markup is the margin, and support prices nothing. The
  // same figure is kept from travellers for the same reason.
  SUPPORT: ["bookings.read", "bookings.cancel", "users.read", "suppliers.read"],
  FINANCE: [
    "bookings.read",
    "bookings.cancel",
    "users.read",
    "users.block",
    "markup.read",
    "markup.write",
    "suppliers.read",
    "revenue.read",
  ],
  SUPER_ADMIN: [...CAPABILITIES],
};

export function can(role: Role, capability: Capability): boolean {
  return GRANTS[role].includes(capability);
}

/** True for any role with a reason to open the admin area at all. */
export function isStaff(role: Role): boolean {
  return GRANTS[role].length > 0;
}

export function capabilitiesOf(role: Role): readonly Capability[] {
  return GRANTS[role];
}
