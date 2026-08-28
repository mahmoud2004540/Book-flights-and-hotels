import { NextResponse } from "next/server";
import { PaymentStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { paymentProvider } from "@/server/payments/registry";

const bodySchema = z.object({
  reference: z.string().min(1),
  email: z.string().email(),
});

/**
 * Creates the payment intent for a booking.
 *
 * The amount comes from the booking row, never from the request: a client that
 * could name the amount could pay one dollar for a thousand-dollar fare.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, reason: "invalid_request" }, { status: 422 });
  }

  const booking = await prisma.booking.findUnique({
    where: { reference: parsed.data.reference },
    include: { payments: true },
  });
  if (!booking) {
    return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  }
  if (booking.status !== "PENDING") {
    return NextResponse.json({ ok: false, reason: "not_payable" }, { status: 409 });
  }

  const provider = await paymentProvider();
  if (!provider) {
    return NextResponse.json({ ok: false, reason: "no_provider" }, { status: 503 });
  }

  try {
    const intent = await provider.createIntent({
      bookingId: booking.id,
      reference: booking.reference,
      amount: Number(booking.totalAmount).toFixed(2),
      currency: booking.currency,
      customerEmail: parsed.data.email,
      // Derived from the booking, so retrying this endpoint reuses the same
      // intent at the provider rather than creating another one.
      idempotencyKey: `intent-${booking.idempotencyKey}`,
    });

    await prisma.payment.upsert({
      where: { providerRef: intent.providerRef },
      update: {},
      create: {
        bookingId: booking.id,
        provider: provider.id,
        providerRef: intent.providerRef,
        amount: Number(booking.totalAmount).toFixed(2),
        currency: booking.currency,
        status: PaymentStatus.PROCESSING,
      },
    });

    return NextResponse.json({
      ok: true,
      clientSecret: intent.clientSecret,
      providerRef: intent.providerRef,
      amount: Number(booking.totalAmount).toFixed(2),
      currency: booking.currency,
    });
  } catch (error) {
    console.error("Creating a payment intent failed:", error);
    return NextResponse.json({ ok: false, reason: "provider_error" }, { status: 502 });
  }
}
