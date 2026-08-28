import { prisma } from "@/lib/prisma";
import { quoteCancellation, departureOf, type CancellationQuote } from "./cancellation-rules";

/**
 * The database side of the cancellation quote. Kept apart from the rules in
 * `cancellation-rules.ts` so those can be exercised without a database — and
 * so nothing that only needs the rules ends up opening a connection.
 */

export async function quoteForBooking(reference: string): Promise<CancellationQuote | null> {
  const booking = await prisma.booking.findUnique({
    where: { reference },
    include: { items: true },
  });
  if (!booking) return null;

  const flightItem = booking.items.find((item) => item.itemType === "flight_offer");
  const details = flightItem?.details as { refundable?: boolean } | null;

  return quoteCancellation({
    status: booking.status,
    totalAmount: Number(booking.totalAmount),
    currency: booking.currency,
    refundableFare: details?.refundable === true,
    departureAt: departureOf(flightItem?.details),
    now: new Date(),
  });
}
