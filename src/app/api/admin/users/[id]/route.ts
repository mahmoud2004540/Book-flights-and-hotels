import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { guard } from "@/server/admin/guard";
import { record } from "@/server/admin/audit";
import { canBlock, canChangeRole } from "@/server/admin/user-rules";

const bodySchema = z.union([
  z.object({ action: z.literal("block"), blocked: z.boolean() }),
  z.object({ action: z.literal("role"), role: z.enum(Role) }),
]);

/**
 * Blocks an account or changes its role — section 7.
 *
 * The two live on one route because they share everything that matters: the
 * capability check, the count of remaining super admins, and the audit entry.
 * Every refusal comes from user-rules.ts, so the same answer holds however the
 * request arrives.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, reason: "bad_request" }, { status: 400 });
  }
  const body = parsed.data;

  const gate = await guard(body.action === "role" ? "users.role" : "users.block");
  if (!gate.ok) return gate.response;
  const { actor } = gate;

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, role: true, isBlocked: true },
  });
  if (!target) return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });

  // Counted inside the request rather than cached: it is the number the
  // lockout rules turn on, and a stale one is how the last admin disappears.
  const superAdminCount = await prisma.user.count({
    where: { role: Role.SUPER_ADMIN, isBlocked: false },
  });

  if (body.action === "block") {
    const decision = canBlock({
      actorId: actor.id,
      targetId: target.id,
      targetRole: target.role,
      blocked: body.blocked,
      superAdminCount,
    });
    if (!decision.allowed) {
      return NextResponse.json({ ok: false, reason: decision.reason }, { status: 409 });
    }

    await prisma.user.update({ where: { id }, data: { isBlocked: body.blocked } });
    await record(actor, body.blocked ? "user.blocked" : "user.unblocked", "user", id, {
      email: target.email,
      from: target.isBlocked,
      to: body.blocked,
    });

    return NextResponse.json({ ok: true, isBlocked: body.blocked });
  }

  const decision = canChangeRole({
    actorId: actor.id,
    actorRole: actor.role,
    targetId: target.id,
    targetRole: target.role,
    nextRole: body.role,
    superAdminCount,
  });
  if (!decision.allowed) {
    return NextResponse.json({ ok: false, reason: decision.reason }, { status: 409 });
  }

  await prisma.user.update({ where: { id }, data: { role: body.role } });
  await record(actor, "user.role_changed", "user", id, {
    email: target.email,
    from: target.role,
    to: body.role,
  });

  return NextResponse.json({ ok: true, role: body.role });
}
