import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { AlertTriangle, CheckCircle2, Download } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card, CardBody } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";

export default async function ConfirmedPage({
  params,
}: {
  params: Promise<{ locale: string; reference: string }>;
}) {
  const { locale, reference } = await params;
  setRequestLocale(locale);

  const booking = await prisma.booking.findUnique({
    where: { reference },
    include: { passengers: true },
  });
  if (!booking) notFound();

  const confirmed = booking.status === "CONFIRMED";
  const refunded = booking.status === "REFUNDED";

  return (
    <div className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
      <Card>
        <CardBody className="flex flex-col items-start gap-4">
          {refunded ? (
            <AlertTriangle className="size-8 text-warn" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="size-8 text-accent" aria-hidden="true" />
          )}
          <h1 className="text-2xl font-semibold">
            {confirmed
              ? "Your booking is confirmed"
              : refunded
                ? "We could not complete this booking"
                : "Your booking is recorded"}
          </h1>
          {refunded && (
            <p className="text-sm text-fg-muted">
              Your payment went through, but the airline could not issue the booking. We have
              refunded you in full and nothing further is needed from you.
            </p>
          )}

          <div className="w-full rounded-md border border-line bg-surface-2 px-4 py-3">
            <p className="text-xs text-fg-muted">Booking reference</p>
            <p className="font-mono text-xl font-semibold tracking-wide">{booking.reference}</p>
          </div>

          <dl className="grid w-full gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-fg-muted">Travellers</dt>
              <dd>
                {booking.passengers
                  .map((passenger) => `${passenger.firstName} ${passenger.lastName}`)
                  .join(", ")}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-fg-muted">Total</dt>
              <dd className="tabular">
                {booking.currency} {Number(booking.totalAmount).toLocaleString("en-GB")}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-fg-muted">Status</dt>
              <dd>{booking.status.toLowerCase()}</dd>
            </div>
          </dl>

          <div className="flex flex-wrap gap-3">
            {booking.status === "PENDING" && (
              <Link href={`/booking/pay/${booking.reference}`} className={buttonVariants({})}>
                Continue to payment
              </Link>
            )}
            {confirmed && (
              <a
                href={`/api/bookings/${booking.reference}/ticket`}
                className={buttonVariants({ variant: "outline" })}
              >
                <Download aria-hidden="true" />
                Download ticket
              </a>
            )}
            <Link href="/dashboard" className={buttonVariants({ variant: "ghost" })}>
              Go to my bookings
            </Link>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
