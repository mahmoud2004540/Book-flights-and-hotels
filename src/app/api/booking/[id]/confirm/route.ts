import { NextResponse } from "next/server";
import { BookingStatus, Prisma, ServiceType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { encryptSecret } from "@/lib/crypto";
import { applyMarkup } from "@/server/pricing/markup";
import { bookingReference } from "@/server/booking/reference";
import {
  discardDraft,
  draftTotal,
  extrasTotal,
  readDraft,
} from "@/server/booking/draft";

const bodySchema = z.object({
  /** Generated once by the client and resent on every retry of the same booking. */
  idempotencyKey: z.string().uuid(),
  acceptedTerms: z.literal(true),
  guestEmail: z.string().email().optional(),
});

/**
 * Step 5 — create the booking.
 *
 * Guarded three ways: the draft must not have expired, a changed price must
 * have been accepted, and the idempotency key must be unused. The third is
 * what stops a double-click or a retried request from producing two bookings.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, reason: "invalid_request" }, { status: 422 });
  }
  const { idempotencyKey, acceptedTerms, guestEmail } = parsed.data;

  // Answered before any other work: a retry must return the original booking,
  // not repeat the checks and certainly not create a second one.
  const existing = await prisma.booking.findUnique({ where: { idempotencyKey } });
  if (existing) {
    return NextResponse.json({ ok: true, reference: existing.reference, replayed: true });
  }

  const draft = await readDraft(id);
  if (!draft) {
    return NextResponse.json({ ok: false, reason: "expired" }, { status: 410 });
  }
  if (!draft.confirmedPrice) {
    return NextResponse.json({ ok: false, reason: "not_priced" }, { status: 409 });
  }
  if (draft.priceChanged && !draft.priceAccepted) {
    return NextResponse.json({ ok: false, reason: "price_not_accepted" }, { status: 409 });
  }
  if (draft.passengers.length === 0) {
    return NextResponse.json({ ok: false, reason: "no_passengers" }, { status: 409 });
  }
  if (!acceptedTerms) {
    return NextResponse.json({ ok: false, reason: "terms_not_accepted" }, { status: 409 });
  }

  const session = await auth();
  const userId = session?.user?.id ?? null;
  if (!userId && !guestEmail) {
    return NextResponse.json({ ok: false, reason: "email_required" }, { status: 409 });
  }

  const net = Number(draft.offer.netPrice.amount);
  const markup = await applyMarkup(draft.offer.netPrice.amount, {
    supplierId: draft.offer.supplierId,
    serviceType: ServiceType.FLIGHT,
  });
  const extras = extrasTotal(draft.extras, draft.passengers.length);
  const total = draftTotal(draft);
  const reference = bookingReference();

  try {
    await prisma.booking.create({
      data: {
        reference,
        userId,
        guestEmail: userId ? null : guestEmail,
        type: ServiceType.FLIGHT,
        supplierId: draft.offer.supplierId,
        supplierRef: draft.offer.supplierOfferRef,
        status: BookingStatus.PENDING,
        netAmount: net.toFixed(2),
        markupAmount: (Number(markup.markup) + extras).toFixed(2),
        totalAmount: total.toFixed(2),
        currency: draft.confirmedPrice.currency,
        idempotencyKey,
        // Payment arrives in stage 5. Until then the booking holds its own
        // deadline so the sweep can clear it if payment never happens.
        expiresAt: new Date(draft.expiresAt),
        passengers: {
          create: draft.passengers.map((passenger) => ({
            firstName: passenger.firstName,
            lastName: passenger.lastName,
            dob: new Date(`${passenger.dob}T00:00:00Z`),
            nationality: passenger.nationality,
            passportNoEnc: encryptSecret(passenger.passportNumber),
            passportExpiry: new Date(`${passenger.passportExpiry}T00:00:00Z`),
            type: passenger.type,
          })),
        },
        items: {
          create: [
            {
              itemType: "flight_offer",
              details: {
                itineraries: draft.offer.itineraries,
                validatingCarrier: draft.offer.validatingCarrier,
              } as unknown as Prisma.InputJsonValue,
              amount: Number(draft.confirmedPrice.amount).toFixed(2),
            },
            ...(extras > 0
              ? [
                  {
                    itemType: "extras",
                    details: draft.extras as unknown as Prisma.InputJsonValue,
                    amount: extras.toFixed(2),
                  },
                ]
              : []),
          ],
        },
      },
    });
  } catch (error) {
    // A unique violation here means a concurrent request won the race with the
    // same key. That is the guard working, so return its booking rather than an error.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const winner = await prisma.booking.findUnique({ where: { idempotencyKey } });
      if (winner) {
        return NextResponse.json({ ok: true, reference: winner.reference, replayed: true });
      }
    }
    console.error("Booking creation failed:", error);
    return NextResponse.json({ ok: false, reason: "server_error" }, { status: 500 });
  }

  await discardDraft(id);
  return NextResponse.json({ ok: true, reference, replayed: false });
}
