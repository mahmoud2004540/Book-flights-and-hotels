import { Briefcase, Plane } from "lucide-react";
import type { Itinerary, PublicFlightOffer } from "@/server/suppliers/types";
import type { FlightSearchInput } from "@/lib/validation/search";
import { SelectOfferButton } from "./select-offer";
import { formatClock, formatDayOffset } from "@/lib/flights";
import { formatAmount, formatDuration } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function Leg({ itinerary }: { itinerary: Itinerary }) {
  const first = itinerary.segments[0];
  const last = itinerary.segments[itinerary.segments.length - 1];
  if (!first || !last) return null;

  const dayOffset = formatDayOffset(first.from.at, last.to.at);

  return (
    <div className="flex items-center gap-4 py-2">
      <div className="w-14 shrink-0">
        <p className="text-lg font-semibold tabular">{formatClock(first.from.at)}</p>
        <p className="text-xs text-fg-muted">{first.from.code}</p>
      </div>

      <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
        <span className="text-xs text-fg-muted tabular">
          {formatDuration(itinerary.durationMinutes)}
        </span>
        <div className="flex w-full items-center gap-1.5">
          <span className="h-px flex-1 bg-line" />
          <Plane className="size-3 shrink-0 text-fg-faint" aria-hidden="true" />
          <span className="h-px flex-1 bg-line" />
        </div>
        <span className="text-xs text-fg-faint">
          {itinerary.stops === 0
            ? "Direct"
            : `${itinerary.stops} stop${itinerary.stops > 1 ? "s" : ""}`}
        </span>
      </div>

      <div className="w-14 shrink-0 text-right">
        <p className="text-lg font-semibold tabular">
          {formatClock(last.to.at)}
          {dayOffset && <sup className="ms-0.5 text-xs text-brand">{dayOffset}</sup>}
        </p>
        <p className="text-xs text-fg-muted">{last.to.code}</p>
      </div>
    </div>
  );
}

export function OfferCard({
  offer,
  cheapest,
  search,
}: {
  offer: PublicFlightOffer;
  cheapest: boolean;
  /** Absent inside the booking flow, where the offer is already chosen. */
  search?: FlightSearchInput;
}) {
  const carrier = offer.itineraries[0]?.segments[0];

  return (
    // The price is exposed as data so the end-to-end suite can assert on the
    // ordering without scraping formatted text out of the card.
    <Card className="transition-shadow hover:shadow-md" data-offer-price={offer.price.amount}>
      <div className="grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:gap-6">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">
              {carrier?.carrierName ?? carrier?.carrierCode ?? "—"}
            </span>
            {cheapest && <Badge tone="brand">Cheapest</Badge>}
            {offer.refundable && <Badge tone="accent">Refundable</Badge>}
          </div>

          <div className="divide-y divide-line-soft">
            {offer.itineraries.map((itinerary, index) => (
              <Leg key={index} itinerary={itinerary} />
            ))}
          </div>

          {offer.baggage.checkedBags !== null && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-fg-muted">
              <Briefcase className="size-3.5" aria-hidden="true" />
              {offer.baggage.checkedBags} checked bag
              {offer.baggage.checkedBags === 1 ? "" : "s"} included
            </p>
          )}
        </div>

        <div className="flex flex-row items-end justify-between gap-3 border-t border-line-soft pt-4 sm:flex-col sm:items-end sm:justify-center sm:border-t-0 sm:border-s sm:ps-6 sm:pt-0">
          <div className="text-right">
            <p className="text-2xl font-semibold tabular">
              {formatAmount(offer.price.amount, offer.price.currency)}
            </p>
            <p className="text-xs text-fg-muted">Total, taxes included</p>
            {offer.seatsRemaining !== null && offer.seatsRemaining <= 4 && (
              <p className="mt-1 text-xs text-warn">
                Only {offer.seatsRemaining} left at this price
              </p>
            )}
          </div>
          {search && <SelectOfferButton offerId={offer.offerId} search={search} />}
        </div>
      </div>
    </Card>
  );
}
