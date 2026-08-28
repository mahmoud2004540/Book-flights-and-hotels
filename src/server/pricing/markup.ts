import { AmountType, ServiceType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Applies our margin on top of the supplier's net price — sections 4.7 and 5.
 *
 * Rules are ordered by priority, lowest number first, so a specific rule
 * ("hotels in Egypt") beats a general one ("everything"). Without that
 * ordering two overlapping rules would have no defined winner.
 */

export type MarkupContext = {
  supplierId: string;
  serviceType: ServiceType;
  destination?: string;
};

export type PricedAmount = {
  net: string;
  markup: string;
  total: string;
};

type Rule = {
  supplierId: string | null;
  serviceType: ServiceType | null;
  destination: string | null;
  type: AmountType;
  value: number;
};

let cached: { rules: Rule[]; loadedAt: number } | null = null;
/** Rules change rarely; re-reading them on every offer would be wasteful. */
const RULE_CACHE_MS = 60_000;

async function activeRules(): Promise<Rule[]> {
  if (cached && Date.now() - cached.loadedAt < RULE_CACHE_MS) return cached.rules;

  const rows = await prisma.markupRule.findMany({
    where: { isActive: true },
    orderBy: { priority: "asc" },
  });

  const rules = rows.map((row) => ({
    supplierId: row.supplierId,
    serviceType: row.serviceType,
    destination: row.destination,
    type: row.type,
    value: Number(row.value),
  }));

  cached = { rules, loadedAt: Date.now() };
  return rules;
}

/** Test hook — drops the rule cache so a change takes effect immediately. */
export function clearMarkupCache(): void {
  cached = null;
}

function matches(rule: Rule, context: MarkupContext): boolean {
  if (rule.supplierId !== null && rule.supplierId !== context.supplierId) return false;
  if (rule.serviceType !== null && rule.serviceType !== context.serviceType) return false;
  if (rule.destination !== null && rule.destination !== context.destination) return false;
  return true;
}

export async function applyMarkup(
  netAmount: string,
  context: MarkupContext,
): Promise<PricedAmount> {
  const rules = await activeRules();
  const rule = rules.find((candidate) => matches(candidate, context));

  const net = Number(netAmount);
  if (!rule) {
    return { net: net.toFixed(2), markup: "0.00", total: net.toFixed(2) };
  }

  const markup = rule.type === AmountType.PERCENT ? (net * rule.value) / 100 : rule.value;

  return {
    net: net.toFixed(2),
    markup: markup.toFixed(2),
    total: (net + markup).toFixed(2),
  };
}

/**
 * Rescales a supplier's fare breakdown onto the price we actually charge.
 *
 * Passing the supplier's own breakdown straight through would publish our net
 * cost beside the marked-up price — subtract one from the other and the margin
 * is in plain sight. Scaling keeps the breakdown honest for the traveller: the
 * lines are in the supplier's own proportion and add up to exactly what they
 * pay, with the margin carried inside the fare rather than named as a line.
 *
 * Taxes are the remainder rather than a second rounded product, so the two
 * lines always sum to the total instead of drifting a cent apart.
 */
export function rescaleFare(
  fare: { base: string; taxesAndFees: string; total: string },
  chargedTotal: string,
): { base: string; taxesAndFees: string; total: string } {
  const net = Number(fare.total);
  const charged = Number(chargedTotal);

  // A zero or unparseable net leaves nothing to scale by; charge the whole
  // amount as base rather than dividing by zero.
  if (!Number.isFinite(net) || net <= 0 || !Number.isFinite(charged)) {
    return { base: chargedTotal, taxesAndFees: "0.00", total: chargedTotal };
  }

  const base = Math.round((Number(fare.base) / net) * charged * 100) / 100;
  return {
    base: base.toFixed(2),
    taxesAndFees: (charged - base).toFixed(2),
    total: charged.toFixed(2),
  };
}
