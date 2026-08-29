import { NextResponse } from "next/server";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { can, type Capability } from "@/lib/admin/permissions";

export type Actor = { id: string; email: string; role: Role };

export type GuardResult =
  | { ok: true; actor: Actor }
  | { ok: false; response: NextResponse };

/**
 * The guard every admin mutation runs first.
 *
 * The role is re-read from the database rather than taken from the session
 * token. The token only refreshes on its own schedule, so a revoked admin would
 * otherwise keep writing for the rest of that window — tolerable for reading a
 * page, not for changing one. A blocked account is refused here too, for the
 * same reason.
 *
 * Everything is refused as 404, not 403: an admin endpoint should not confirm
 * its own existence to someone who may not use it.
 */
export async function guard(capability: Capability): Promise<GuardResult> {
  const denied = {
    ok: false as const,
    response: NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 }),
  };

  const session = await auth();
  if (!session?.user?.id) return denied;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, role: true, isBlocked: true },
  });
  if (!user || user.isBlocked || !can(user.role, capability)) return denied;

  return { ok: true, actor: { id: user.id, email: user.email, role: user.role } };
}
