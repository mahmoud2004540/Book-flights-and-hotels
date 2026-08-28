import { prisma } from "@/lib/prisma";

/**
 * Asks the supplier to issue the booking.
 *
 * Under the affiliate model chosen for launch we do not issue tickets — the
 * supplier does, and this records the hand-off. Under a merchant-of-record
 * agreement this calls the adapter's bookFlight and returns a real PNR. The
 * signature is the same either way, so switching is a change here and nowhere else.
 */
export type IssueResult =
  | { ok: true; pnr: string | null; supplierRef: string | null }
  | { ok: false; reason: string };

export async function issueWithSupplier(bookingId: string): Promise<IssueResult> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { supplierRef: true, supplierId: true },
  });

  if (!booking) return { ok: false, reason: "booking_not_found" };

  try {
    // Affiliate model: no PNR is created by us. When a merchant-of-record
    // agreement is in place, this is where bookFlight is called and its PNR
    // returned instead of null.
    return { ok: true, pnr: null, supplierRef: booking.supplierRef };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "supplier_error",
    };
  }
}
