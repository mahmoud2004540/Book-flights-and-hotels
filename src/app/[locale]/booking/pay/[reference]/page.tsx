import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { PayPanel } from "@/components/payment/pay-panel";
import { Card, CardBody } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";

export default async function PayPage({
  params,
}: {
  params: Promise<{ locale: string; reference: string }>;
}) {
  const { locale, reference } = await params;
  setRequestLocale(locale);

  const booking = await prisma.booking.findUnique({ where: { reference } });
  if (!booking) notFound();

  if (booking.status !== "PENDING") {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 sm:px-6">
        <Card>
          <CardBody className="flex flex-col items-start gap-3 py-10">
            <h1 className="text-xl font-semibold">This booking is not awaiting payment</h1>
            <p className="text-sm text-fg-muted">
              Its current status is {booking.status.toLowerCase()}.
            </p>
            <Link
              href={`/booking/confirmed/${booking.reference}`}
              className={buttonVariants({ variant: "outline" })}
            >
              View the booking
            </Link>
          </CardBody>
        </Card>
      </div>
    );
  }

  const session = await auth();
  const email = booking.guestEmail ?? session?.user?.email ?? "";

  return (
    <div className="mx-auto max-w-lg px-4 py-10 sm:px-6">
      <h1 className="mb-6 text-2xl font-semibold">Payment</h1>
      <PayPanel
        reference={booking.reference}
        email={email}
        amount={Number(booking.totalAmount).toFixed(2)}
        currency={booking.currency}
        mockMode={process.env.PAYMENT_MOCK_ENABLED === "true"}
      />
    </div>
  );
}
