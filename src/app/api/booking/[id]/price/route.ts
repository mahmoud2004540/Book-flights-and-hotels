import { NextResponse } from "next/server";
import { ServiceType } from "@prisma/client";
import { applyMarkup } from "@/server/pricing/markup";
import { readDraft, saveDraft } from "@/server/booking/draft";
import { flightAdapters } from "@/server/suppliers/registry";

/**
 * Step 2 — mandatory re-pricing.
 *
 * Runs every time the traveller reaches this step, with no cached shortcut.
 * Fares move between search and checkout, and the whole point of this call is
 * to find out before money changes hands rather than after.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const draft = await readDraft(id);

  if (!draft) {
    return NextResponse.json({ ok: false, reason: "expired" }, { status: 410 });
  }

  const adapter = (await flightAdapters()).find(
    (candidate) => candidate.id === draft.offer.supplierId,
  );
  if (!adapter) {
    return NextResponse.json({ ok: false, reason: "supplier_unavailable" }, { status: 502 });
  }

  try {
    const priced = await adapter.confirmFlightPrice(draft.offer);

    if (!priced.available) {
      return NextResponse.json({ ok: false, reason: "sold_out" }, { status: 409 });
    }

    const withMarkup = await applyMarkup(priced.netPrice.amount, {
      supplierId: draft.offer.supplierId,
      serviceType: ServiceType.FLIGHT,
      destination: draft.offer.itineraries[0]?.segments.at(-1)?.to.code,
    });

    const confirmed = { amount: withMarkup.total, currency: priced.netPrice.currency };
    const changed = confirmed.amount !== draft.quotedPrice.amount;

    draft.confirmedPrice = confirmed;
    draft.priceChanged = changed;
    // A changed price needs explicit consent; an unchanged one is accepted
    // implicitly, because there is nothing for the traveller to decide.
    draft.priceAccepted = !changed;
    draft.offer = { ...draft.offer, supplierPayload: priced.supplierPayload };
    await saveDraft(draft);

    return NextResponse.json({
      ok: true,
      quotedPrice: draft.quotedPrice,
      confirmedPrice: confirmed,
      changed,
      difference: (Number(confirmed.amount) - Number(draft.quotedPrice.amount)).toFixed(2),
    });
  } catch (error) {
    console.error("Re-pricing failed:", error);
    return NextResponse.json({ ok: false, reason: "supplier_error" }, { status: 502 });
  }
}
