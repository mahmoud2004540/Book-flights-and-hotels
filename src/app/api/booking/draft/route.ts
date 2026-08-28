import { NextResponse } from "next/server";
import { z } from "zod";
import { flightSearchSchema } from "@/lib/validation/search";
import { createDraft } from "@/server/booking/draft";
import { findOfferForBooking } from "@/server/booking/offer-lookup";

const bodySchema = z.object({
  offerId: z.string().min(1),
  search: flightSearchSchema,
});

/**
 * Step 1 — the traveller picked an offer.
 *
 * The offer is re-read from the search cache rather than accepted from the
 * request body: a client that could post its own offer could post its own
 * price too.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Malformed request." }, { status: 422 });
  }

  const found = await findOfferForBooking(parsed.data.offerId, parsed.data.search);
  if (!found) {
    return NextResponse.json(
      { ok: false, message: "That offer is no longer available. Search again." },
      { status: 410 },
    );
  }

  const draft = await createDraft(found.offer, found.publicPrice);
  return NextResponse.json({ ok: true, draftId: draft.id });
}
