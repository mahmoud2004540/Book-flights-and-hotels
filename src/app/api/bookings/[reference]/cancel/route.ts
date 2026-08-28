import { NextResponse } from "next/server";
import { BookingStatus, PaymentStatus, RefundStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { sendMail } from "@/lib/mail";
import { paymentProvider } from "@/server/payments/registry";
import { quoteForBooking } from "@/server/booking/cancellation";

/** The quote, shown before anything is cancelled — section 4.6. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ reference: string }> },
): Promise<NextResponse> {
  const { reference } = await params;
  const denied = await denyIfNotOwner(reference);
  if (denied) return denied;

  const quote = await quoteForBooking(reference);
  if (!quote) return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });

  return NextResponse.json({ ok: true, quote });
}

/** Cancels, refunding whatever the quote said — never more, never less. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ reference: string }> },
): Promise<NextResponse> {
  const { reference } = await params;
  const denied = await denyIfNotOwner(reference);
  if (denied) return denied;

  // Re-quoted here rather than trusting a figure sent by the client, and
  // because time has passed since the traveller was shown it.
  const quote = await quoteForBooking(reference);
  if (!quote) return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  if (!quote.allowed) {
    return NextResponse.json({ ok: false, reason: quote.reason }, { status: 409 });
  }

  const booking = await prisma.booking.findUniqueOrThrow({
    where: { reference },
    include: { payments: { where: { status: PaymentStatus.SUCCEEDED } } },
  });

  const refundAmount = Number(quote.refundAmount);
  const payment = booking.payments[0];

  if (refundAmount > 0 && payment) {
    const provider = await paymentProvider();
    let status: RefundStatus = RefundStatus.PENDING;
    let refundRef: string | null = null;

    if (provider) {
      try {
        const refund = await provider.refund({
          providerRef: payment.providerRef,
          amount: quote.refundAmount,
          reason: "Cancelled by the traveller",
        });
        refundRef = refund.refundRef;
        status =
          refund.status === "succeeded"
            ? RefundStatus.SUCCEEDED
            : refund.status === "failed"
              ? RefundStatus.FAILED
              : RefundStatus.PENDING;
      } catch (error) {
        // The booking is still cancelled; the refund is left PENDING for
        // support rather than trapping the traveller in a cancelled-but-unrefunded state.
        console.error("Refund on cancellation failed:", error);
        status = RefundStatus.FAILED;
      }
    }

    await prisma.refund.create({
      data: {
        paymentId: payment.id,
        amount: quote.refundAmount,
        reason: "Cancelled by the traveller",
        status,
        providerRef: refundRef,
      },
    });
  }

  await prisma.$transaction([
    prisma.booking.update({
      where: { id: booking.id },
      data: { status: BookingStatus.CANCELLED },
    }),
    prisma.auditLog.create({
      data: {
        action: "booking.cancelled",
        entity: "booking",
        entityId: booking.id,
        diff: { refundAmount: quote.refundAmount, fee: quote.fee },
      },
    }),
  ]);

  const to = booking.guestEmail ?? (await emailFor(booking.userId));
  if (to) {
    const sent = await sendMail(to, {
      kind: "bookingCancelled",
      reference: booking.reference,
      refund:
        refundAmount > 0
          ? `${quote.currency} ${quote.refundAmount}`
          : "No refund is due under the fare rules",
    });
    if (!sent.ok) console.error(`Cancellation email failed: ${sent.error}`);
  }

  return NextResponse.json({ ok: true, refundAmount: quote.refundAmount });
}

/** A booking that belongs to an account is only reachable by that account. */
async function denyIfNotOwner(reference: string): Promise<NextResponse | null> {
  const booking = await prisma.booking.findUnique({
    where: { reference },
    select: { userId: true },
  });
  if (!booking) return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  if (!booking.userId) return null;

  const session = await auth();
  if (session?.user?.id !== booking.userId) {
    return NextResponse.json({ ok: false, reason: "forbidden" }, { status: 403 });
  }
  return null;
}

async function emailFor(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  return user?.email ?? null;
}
