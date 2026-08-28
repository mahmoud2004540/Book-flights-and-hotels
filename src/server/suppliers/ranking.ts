import { SUPPLIER_PRIORITY, type SupplierId } from "@/lib/config";

/**
 * How two offers for the same thing are ranked — the answer to "cheapest in
 * the world, and the best quality of the cheap ones".
 *
 * Price comes first and decides almost everything: suppliers are queried in
 * parallel and the list is sorted cheapest first, so this never makes anyone
 * pay more. The supplier order only settles an exact tie, and there the tie
 * goes to the supplier that gives the better booking — the one where we issue
 * the ticket ourselves rather than handing the traveller to someone else.
 *
 * Without this the winner of a tie was whichever supplier's response happened
 * to be merged first, which is not a decision anyone made.
 */

export function supplierRank(id: SupplierId): number {
  return SUPPLIER_PRIORITY[id];
}

/** Cheaper wins; on an exact tie, the higher-ranked supplier wins. */
export function byPriceThenSupplier(
  a: { amount: string; supplierId: SupplierId },
  b: { amount: string; supplierId: SupplierId },
): number {
  const difference = Number(a.amount) - Number(b.amount);
  if (difference !== 0) return difference;
  return supplierRank(a.supplierId) - supplierRank(b.supplierId);
}

/**
 * Whether a challenger should displace the offer already held for the same
 * flight or property. Strictly cheaper always displaces; an equal price
 * displaces only when the challenger's supplier ranks higher.
 */
export function beats(
  challenger: { amount: string; supplierId: SupplierId },
  incumbent: { amount: string; supplierId: SupplierId },
): boolean {
  return byPriceThenSupplier(challenger, incumbent) < 0;
}
