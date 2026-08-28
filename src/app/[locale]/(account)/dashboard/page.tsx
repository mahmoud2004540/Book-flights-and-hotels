import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireUser } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { bucketOf, type BookingBucket } from "@/lib/bookings";
import { departureOf } from "@/server/booking/cancellation-rules";
import { BookingTabs } from "@/components/account/booking-tabs";
import type { BookingSummary } from "@/components/account/booking-row";

type StoredItinerary = { segments: Array<{ from: { code: string }; to: { code: string } }> };

/** "CAI → DXB → CAI", built from the stored itinerary. */
function routeOf(details: unknown): string | null {
  const itineraries = (details as { itineraries?: StoredItinerary[] } | null)?.itineraries;
  if (!itineraries || itineraries.length === 0) return null;

  const codes: string[] = [];
  for (const itinerary of itineraries) {
    const first = itinerary.segments[0];
    const last = itinerary.segments[itinerary.segments.length - 1];
    if (!first || !last) continue;
    if (codes.length === 0) codes.push(first.from.code);
    codes.push(last.to.code);
  }
  return codes.length > 1 ? codes.join(" → ") : null;
}

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await requireUser("/dashboard");
  const t = await getTranslations("account");

  const bookings = await prisma.booking.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { items: { where: { itemType: "flight_offer" } } },
  });

  const now = new Date();
  const buckets: Record<BookingBucket, BookingSummary[]> = {
    upcoming: [],
    past: [],
    cancelled: [],
  };

  for (const booking of bookings) {
    const details = booking.items[0]?.details;
    const departureAt = departureOf(details);
    const summary: BookingSummary = {
      reference: booking.reference,
      status: booking.status,
      route: routeOf(details),
      departureAt,
      total: Number(booking.totalAmount).toFixed(2),
      currency: booking.currency,
      createdAt: booking.createdAt,
    };
    buckets[bucketOf({ status: booking.status, departureAt, now })].push(summary);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">
        {t("greeting", { name: user.name ?? user.email })}
      </h1>
      <BookingTabs buckets={buckets} />
    </div>
  );
}
