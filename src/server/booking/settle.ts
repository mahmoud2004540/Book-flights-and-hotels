import { BookingStatus, PaymentStatus, RefundStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { paymentProvider } from "@/server/payments/registry";
import { sendMail } from "@/lib/mail";
import { issueWithSupplier, type IssueResult } from "./issue";

/**
 * What happens once a payment succeeds.
 *
 * The order matters and cannot be swapped: money is taken first, then the
 * supplier is asked to issue. That leaves one dangerous window — paid but not
 * issued — and section 4.5 requires it to resolve into an immediate refund
 * rather than a support ticket. That is what this function guarantees.
 *
 * Idempotent by design: webhooks are delivered more than once, so a booking
 * already settled returns its existing outcome instead of issuing twice.
 */

export type SettleOutcome =
  | { status: "confirmed"; reference: string; pnr: string | null }
  | { status: "refunded"; reference: string; reason: string }
  | { status: "ignored"; reason: string };

/**
 * The issuer is injectable so the paid-but-not-issued path can be exercised by
 * a test. Without this seam the automatic refund — the branch that matters most
 * here — could only ever be reasoned about, never run.
 */
export async function settleBooking(
  providerRef: string,
  issue: (bookingId: string) => Promise<IssueResult> = issueWithSupplier,
): Promise<SettleOutcome> {
  const payment = await prisma.payment.findUnique({
    where: { providerRef },
    include: { booking: true },
  });

  if (!payment) return { status: "ignored", reason: "unknown_payment" };

  const booking = payment.booking;

  // Already settled: a repeated webhook must not issue a second time.
  if (booking.status === BookingStatus.CONFIRMED) {
    return { status: "confirmed", reference: booking.reference, pnr: booking.pnr };
  }
  if (booking.status === BookingStatus.REFUNDED || booking.status === BookingStatus.FAILED) {
    return { status: "ignored", reason: "already_resolved" };
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: { status: PaymentStatus.SUCCEEDED },
  });

  const issued = await issue(booking.id);

  if (issued.ok) {
    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: BookingStatus.CONFIRMED,
        pnr: issued.pnr,
        supplierRef: issued.supplierRef,
        expiresAt: null,
      },
    });

    const to = booking.guestEmail ?? (await recipientFor(booking.userId));
    if (to) {
      const sent = await sendMail(to, {
        kind: "bookingConfirmed",
        reference: booking.reference,
        pnr: issued.pnr,
        total: `${booking.currency} ${Number(booking.totalAmount).toFixed(2)}`,
      });
      if (!sent.ok) console.error(`Confirmation email failed for ${booking.reference}: ${sent.error}`);
    }

    return { status: "confirmed", reference: booking.reference, pnr: issued.pnr };
  }

  // Paid but not issued. Refund now, automatically, and tell everyone who
  // needs to know — the traveller must never be left chasing this.
  return refundFailedIssue(payment.id, providerRef, booking.id, issued.reason);
}

async function refundFailedIssue(
  paymentId: string,
  providerRef: string,
  bookingId: string,
  reason: string,
): Promise<SettleOutcome> {
  const booking = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
  const provider = await paymentProvider();

  let refundStatus: RefundStatus = RefundStatus.FAILED;
  let refundRef: string | null = null;

  if (provider) {
    try {
      const refund = await provider.refund({
        providerRef,
        amount: Number(booking.totalAmount).toFixed(2),
        reason: `Issuance failed: ${reason}`,
      });
      refundRef = refund.refundRef;
      refundStatus =
        refund.status === "succeeded"
          ? RefundStatus.SUCCEEDED
          : refund.status === "failed"
            ? RefundStatus.FAILED
            : RefundStatus.PENDING;
    } catch (error) {
      console.error("Automatic refund failed:", error);
    }
  }

  await prisma.$transaction([
    prisma.refund.create({
      data: {
        paymentId,
        amount: Number(booking.totalAmount).toFixed(2),
        reason: `Issuance failed: ${reason}`,
        status: refundStatus,
        providerRef: refundRef,
      },
    }),
    prisma.payment.update({
      where: { id: paymentId },
      data: { status: PaymentStatus.REFUNDED },
    }),
    prisma.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.REFUNDED, expiresAt: null },
    }),
    // The admin alert is a row rather than a log line, so it survives the
    // process and shows up in the dashboard built in stage 7.
    prisma.auditLog.create({
      data: {
        action: "booking.issuance_failed",
        entity: "booking",
        entityId: bookingId,
        diff: { reason, refundStatus, refundRef },
      },
    }),
  ]);

  const to = booking.guestEmail ?? (await recipientFor(booking.userId));
  if (to) {
    const sent = await sendMail(to, {
      kind: "bookingRefunded",
      reference: booking.reference,
      total: `${booking.currency} ${Number(booking.totalAmount).toFixed(2)}`,
    });
    if (!sent.ok) console.error(`Refund email failed for ${booking.reference}: ${sent.error}`);
  }

  return { status: "refunded", reference: booking.reference, reason };
}

async function recipientFor(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  return user?.email ?? null;
}

/** A payment the provider reports as failed. No refund is due — nothing was taken. */
export async function markPaymentFailed(providerRef: string): Promise<void> {
  const payment = await prisma.payment.findUnique({ where: { providerRef } });
  if (!payment) return;

  await prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.FAILED },
    }),
    prisma.booking.update({
      where: { id: payment.bookingId },
      data: { status: BookingStatus.FAILED },
    }),
  ]);
}
