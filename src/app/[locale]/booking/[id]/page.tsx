import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { readDraft } from "@/server/booking/draft";
import { BookingWizard } from "@/components/booking/wizard";
import type { PublicFlightOffer } from "@/server/suppliers/types";

export default async function BookingPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const draft = await readDraft(id);
  if (!draft) notFound();

  const session = await auth();

  // The supplier payload and net price are stripped here, at the boundary,
  // so neither can reach the browser through the wizard's props.
  const { netPrice: _netPrice, supplierPayload: _payload, ...rest } = draft.offer;
  const offer: PublicFlightOffer = { ...rest, price: draft.quotedPrice };

  const departDate = draft.offer.itineraries[0]?.segments[0]?.from.at.slice(0, 10) ?? "";

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-2xl font-semibold">Complete your booking</h1>
      <BookingWizard
        draftId={draft.id}
        offer={offer}
        quotedPrice={draft.quotedPrice}
        expiresAt={draft.expiresAt}
        passengerCount={Math.max(draft.passengers.length, 1)}
        departDate={departDate}
        signedIn={Boolean(session?.user?.id)}
      />
    </div>
  );
}
