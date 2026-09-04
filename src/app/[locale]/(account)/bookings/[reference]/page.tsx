import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Download } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { quoteForBooking } from "@/server/booking/cancellation";
import { departureOf } from "@/server/booking/cancellation-rules";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { STATUS_TONE } from "@/lib/bookings";
import { formatAmount, formatDate } from "@/lib/format";
import { formatClock } from "@/lib/flights";
import { CancelBooking } from "@/components/account/cancel-booking";

type StoredSegment = {
  carrierName: string | null;
  carrierCode: string;
  flightNumber: string;
  from: { code: string; at: string };
  to: { code: string; at: string };
};

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ locale: string; reference: string }>;
}) {
  const { locale, reference } = await params;
  setRequestLocale(locale);

  const booking = await prisma.booking.findUnique({
    where: { reference },
    include: { passengers: true, items: true, payments: { include: { refunds: true } } },
  });
  if (!booking) notFound();

  if (booking.userId) {
    const session = await auth();
    if (session?.user?.id !== booking.userId) notFound();
  }

  const flightItem = booking.items.find((item) => item.itemType === "flight_offer");
  const itineraries =
    (flightItem?.details as { itineraries?: Array<{ segments: StoredSegment[] }> } | null)
      ?.itineraries ?? [];
  const departureAt = departureOf(flightItem?.details);
  const quote = await quoteForBooking(reference);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-sm text-fg-muted">{booking.reference}</p>
          <h1 className="mt-1 flex flex-wrap items-center gap-3 text-2xl font-semibold">
            Your booking
            <Badge tone={STATUS_TONE[booking.status]}>{booking.status.toLowerCase()}</Badge>
          </h1>
          {departureAt && (
            <p className="mt-1 text-sm text-fg-muted">Departs {formatDate(departureAt)}</p>
          )}
        </div>

        {booking.status === "CONFIRMED" && (
          <a
            href={`/api/bookings/${booking.reference}/confirmation`}
            className={buttonVariants({ variant: "outline" })}
          >
            <Download aria-hidden="true" />
            Download confirmation
          </a>
        )}
      </div>

      {itineraries.length > 0 && (
        <Card>
          <CardBody className="flex flex-col gap-4">
            <h2 className="font-semibold">Itinerary</h2>
            {itineraries.map((itinerary, index) => (
              <div key={index} className="flex flex-col gap-2">
                {itinerary.segments.map((segment, segIndex) => (
                  <div key={segIndex} className="flex flex-wrap items-baseline gap-x-3 text-sm">
                    <span className="font-medium">
                      {segment.carrierName ?? segment.carrierCode} {segment.flightNumber}
                    </span>
                    <span className="tabular">
                      {segment.from.code} {formatClock(segment.from.at)} →{" "}
                      {segment.to.code} {formatClock(segment.to.at)}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      <Card>
        <CardBody className="flex flex-col gap-3">
          <h2 className="font-semibold">Travellers</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {booking.passengers.map((passenger) => (
              <li key={passenger.id} className="flex justify-between gap-4">
                <span>
                  {passenger.firstName} {passenger.lastName}
                </span>
                <span className="text-fg-muted">{passenger.type.toLowerCase()}</span>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="flex flex-col gap-2">
          <h2 className="mb-1 font-semibold">Payment</h2>
          <div className="flex justify-between gap-4 text-sm">
            <span className="text-fg-muted">Total</span>
            <span className="tabular">
              {formatAmount(booking.totalAmount.toString(), booking.currency)}
            </span>
          </div>
          {booking.payments.map((payment) => (
            <div key={payment.id} className="flex flex-col gap-1">
              <div className="flex justify-between gap-4 text-sm">
                <span className="text-fg-muted">
                  {payment.provider} · {payment.status.toLowerCase()}
                </span>
                <span className="tabular">
                  {formatAmount(payment.amount.toString(), payment.currency)}
                </span>
              </div>
              {payment.refunds.map((refund) => (
                <div key={refund.id} className="flex justify-between gap-4 text-sm text-accent">
                  <span>Refund · {refund.status.toLowerCase()}</span>
                  <span className="tabular">
                    −{formatAmount(refund.amount.toString(), payment.currency)}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </CardBody>
      </Card>

      {quote?.allowed && <CancelBooking reference={booking.reference} />}
    </div>
  );
}
