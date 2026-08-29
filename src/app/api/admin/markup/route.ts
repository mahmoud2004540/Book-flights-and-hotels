import { NextResponse } from "next/server";
import { AmountType, ServiceType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { guard } from "@/server/admin/guard";
import { record } from "@/server/admin/audit";
import { clearMarkupCache } from "@/server/pricing/markup";

/**
 * A null on any of the three scoping fields means "everything", which is how a
 * catch-all rule is written. The empty string a <select> submits is normalised
 * to null rather than stored, so "" never becomes a destination nobody matches.
 */
const blankToNull = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => (value === "" || value === undefined ? null : value), schema.nullable());

const ruleSchema = z.object({
  supplierId: blankToNull(z.string().min(1)),
  serviceType: blankToNull(z.enum(ServiceType)),
  destination: blankToNull(z.string().min(2).max(64)),
  type: z.enum(AmountType),
  // A negative markup would sell below cost, and a percentage above 100 is
  // almost always a typo for a fixed amount.
  value: z.coerce.number().min(0).max(100_000),
  priority: z.coerce.number().int().min(1).max(10_000),
  isActive: z.boolean().default(true),
});

export async function POST(request: Request): Promise<NextResponse> {
  const gate = await guard("markup.write");
  if (!gate.ok) return gate.response;

  const parsed = ruleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, reason: parsed.error.issues[0]?.message ?? "bad_request" },
      { status: 400 },
    );
  }
  const rule = parsed.data;

  if (rule.type === AmountType.PERCENT && rule.value > 100) {
    return NextResponse.json(
      { ok: false, reason: "A percentage markup above 100% is almost always a typo." },
      { status: 400 },
    );
  }

  const created = await prisma.markupRule.create({
    data: { ...rule, value: rule.value.toFixed(2) },
  });

  // The pricing layer caches rules for a minute; without this the new rule
  // would apply to some searches and not others until the cache expired.
  clearMarkupCache();
  await record(gate.actor, "markup.created", "markup_rule", created.id, { ...rule });

  return NextResponse.json({ ok: true, id: created.id });
}
