import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { guard } from "@/server/admin/guard";
import { record } from "@/server/admin/audit";
import { clearMarkupCache } from "@/server/pricing/markup";

const patchSchema = z.object({ isActive: z.boolean() });

/** Deactivating rather than deleting keeps the rule that priced past bookings. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const gate = await guard("markup.write");
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, reason: "bad_request" }, { status: 400 });
  }

  const rule = await prisma.markupRule.findUnique({ where: { id } });
  if (!rule) return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });

  await prisma.markupRule.update({ where: { id }, data: { isActive: parsed.data.isActive } });
  clearMarkupCache();
  await record(gate.actor, "markup.toggled", "markup_rule", id, {
    from: rule.isActive,
    to: parsed.data.isActive,
  });

  return NextResponse.json({ ok: true, isActive: parsed.data.isActive });
}
