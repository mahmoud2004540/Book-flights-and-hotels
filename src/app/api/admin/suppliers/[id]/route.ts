import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { guard } from "@/server/admin/guard";
import { record } from "@/server/admin/audit";
import { clearRegistryCache } from "@/server/suppliers/registry";

const patchSchema = z
  .object({
    isActive: z.boolean().optional(),
    priority: z.coerce.number().int().min(1).max(10_000).optional(),
  })
  .refine((body) => body.isActive !== undefined || body.priority !== undefined, {
    message: "Nothing to change.",
  });

/**
 * Turns a supplier on or off, and sets where it sits when prices tie.
 *
 * Turning one off does not remove it from past bookings — those keep the
 * supplier that actually sold them — it only stops new searches reaching it.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const gate = await guard("suppliers.write");
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, reason: "bad_request" }, { status: 400 });
  }

  const supplier = await prisma.supplier.findUnique({ where: { id } });
  if (!supplier) return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });

  const next = {
    isActive: parsed.data.isActive ?? supplier.isActive,
    priority: parsed.data.priority ?? supplier.priority,
  };

  // Search would keep hitting a supplier that was just switched off, for as
  // long as the registry's own cache holds.
  if (next.isActive === false && supplier.isActive) {
    const remaining = await prisma.supplier.count({ where: { isActive: true, NOT: { id } } });
    if (remaining === 0) {
      return NextResponse.json(
        { ok: false, reason: "This is the only active supplier. Search would return nothing." },
        { status: 409 },
      );
    }
  }

  await prisma.supplier.update({ where: { id }, data: next });
  clearRegistryCache();
  await record(gate.actor, "supplier.updated", "supplier", id, {
    from: { isActive: supplier.isActive, priority: supplier.priority },
    to: next,
  });

  return NextResponse.json({ ok: true, ...next });
}
