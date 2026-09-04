import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { guard, type Actor } from "@/server/admin/guard";
import { record } from "@/server/admin/audit";
import { clearRegistryCache } from "@/server/suppliers/registry";

const patchSchema = z
  .object({
    isActive: z.boolean().optional(),
    priority: z.coerce.number().int().min(1).max(10_000).optional(),
    /**
     * Moving one place up or down, rather than naming a number.
     *
     * "Lower priority wins" is the model the code uses and the wrong thing to
     * put in front of someone deciding which supplier they prefer. The server
     * works out the swap because only it knows the current order, so two
     * people reordering at once cannot both compute it from a stale page.
     */
    move: z.enum(["up", "down"]).optional(),
  })
  .refine(
    (body) =>
      body.isActive !== undefined || body.priority !== undefined || body.move !== undefined,
    { message: "Nothing to change." },
  );

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

  if (parsed.data.move) {
    return swapWithNeighbour(gate.actor, supplier, parsed.data.move);
  }

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

/**
 * Swaps a supplier with the one next to it in the order.
 *
 * Both rows move in one transaction. Priorities carry no unique constraint, so
 * a half-applied swap would leave two suppliers claiming the same place — the
 * tie-break would then fall back to whatever order the merge happened to
 * produce, which is exactly the arbitrariness this ordering exists to remove.
 */
async function swapWithNeighbour(
  actor: Actor,
  supplier: { id: string; priority: number },
  direction: "up" | "down",
): Promise<NextResponse> {
  const neighbour = await prisma.supplier.findFirst({
    where:
      direction === "up"
        ? { priority: { lt: supplier.priority } }
        : { priority: { gt: supplier.priority } },
    orderBy: { priority: direction === "up" ? "desc" : "asc" },
  });

  if (!neighbour) {
    return NextResponse.json(
      { ok: false, reason: direction === "up" ? "Already first." : "Already last." },
      { status: 409 },
    );
  }

  await prisma.$transaction([
    prisma.supplier.update({ where: { id: supplier.id }, data: { priority: neighbour.priority } }),
    prisma.supplier.update({ where: { id: neighbour.id }, data: { priority: supplier.priority } }),
  ]);

  clearRegistryCache();
  await record(actor, "supplier.reordered", "supplier", supplier.id, {
    swappedWith: neighbour.id,
    from: supplier.priority,
    to: neighbour.priority,
  });

  return NextResponse.json({ ok: true, priority: neighbour.priority });
}
