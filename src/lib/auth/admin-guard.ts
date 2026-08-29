import { notFound } from "next/navigation";
import type { Role } from "@prisma/client";
import { auth } from "./index";
import { can, isStaff, type Capability } from "@/lib/admin/permissions";

export type StaffUser = { id: string; email: string; name: string | null; role: Role };

/**
 * Server-side guard for admin pages.
 *
 * Refuses with notFound() rather than a redirect to sign-in: to anyone without
 * the capability the admin area should not appear to exist. A redirect would
 * confirm the route is real, and which roles it wants.
 */
export async function requireCapability(capability: Capability): Promise<StaffUser> {
  const staff = await staffUser();
  if (!staff || !can(staff.role, capability)) notFound();
  return staff;
}

/** For the admin shell itself, which any staff role may open. */
export async function requireStaff(): Promise<StaffUser> {
  const staff = await staffUser();
  if (!staff) notFound();
  return staff;
}

/**
 * The signed-in user's role read from the session token, which the JWT carries
 * and refreshes on its own schedule. A role revoked mid-session therefore has
 * to be checked against the row that mutations actually write, not this — see
 * requireCapabilityForApi().
 */
async function staffUser(): Promise<StaffUser | null> {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) return null;

  const role = session.user.role as Role;
  if (!isStaff(role)) return null;

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name ?? null,
    role,
  };
}
