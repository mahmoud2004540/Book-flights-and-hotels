import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { buildTicketPdf, type TicketSegment } from "@/server/pdf/ticket";

type StoredItinerary = {
  segments: Array<{
    carrierName: string | null;
    carrierCode: string;
    flightNumber: string;
    from: { code: string; at: string };
    to: { code: string; at: string };
  }>;
};

/**
 * The booking confirmation, as a PDF.
 *
 * Named a confirmation and not a ticket because that is what it is: a record
 * of what was booked and paid. A ticket is issued by an airline and carries an
 * e-ticket number, and nothing here issues one yet — see issue.ts. Calling it
 * a ticket would promise a document this does not produce.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ reference: string }> },
): Promise<NextResponse> {
  const { reference } = await params;

  const booking = await prisma.booking.findUnique({
    where: { reference },
    include: { passengers: true, items: true },
  });
  if (!booking) {
    return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  }

  // A booking that belongs to an account is only downloadable by that account.
  // Guest bookings are reachable by reference, which is the only handle a guest has.
  if (booking.userId) {
    const session = await auth();
    if (session?.user?.id !== booking.userId) {
      return NextResponse.json({ ok: false, reason: "forbidden" }, { status: 403 });
    }
  }

  if (booking.status !== "CONFIRMED") {
    return NextResponse.json({ ok: false, reason: "not_confirmed" }, { status: 409 });
  }

  const flightItem = booking.items.find((item) => item.itemType === "flight_offer");
  const itineraries = (flightItem?.details as { itineraries?: StoredItinerary[] } | null)
    ?.itineraries;

  const segments: TicketSegment[] = (itineraries ?? []).flatMap((itinerary) =>
    itinerary.segments.map((segment) => ({
      carrierName: segment.carrierName ?? segment.carrierCode,
      flightNumber: segment.flightNumber,
      from: segment.from.code,
      to: segment.to.code,
      departAt: segment.from.at,
      arriveAt: segment.to.at,
    })),
  );

  const pdf = await buildTicketPdf({
    reference: booking.reference,
    pnr: booking.pnr,
    passengers: booking.passengers.map((p) => `${p.firstName} ${p.lastName}`),
    segments,
    total: `${booking.currency} ${Number(booking.totalAmount).toFixed(2)}`,
    issuedAt: booking.updatedAt,
  });

  return new NextResponse(pdf as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${booking.reference}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
