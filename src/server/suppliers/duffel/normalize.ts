import { CURRENCIES, type CurrencyCode } from "@/lib/config";
import type {
  BaggageAllowance,
  Itinerary,
  NormalizedFlightOffer,
  NormalizedPlace,
  PlaceKind,
  Segment,
} from "../types";
import { parseIsoDuration } from "../amadeus/normalize";
import type { DuffelOffer } from "./schemas";
import { placeSuggestionsSchema } from "./schemas";

/**
 * Converts Duffel shapes into our own. This file is the only place that knows
 * what a Duffel response looks like.
 */

/** Minutes between two ISO timestamps, for the segments Duffel gives no duration. */
function minutesBetween(from: string, to: string): number {
  const start = new Date(from).getTime();
  const end = new Date(to).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.max(0, Math.round((end - start) / 60_000));
}

function normalizeSegment(segment: DuffelOffer["slices"][number]["segments"][number]): Segment {
  const carrierCode = segment.marketing_carrier.iata_code ?? "";
  const number = segment.marketing_carrier_flight_number ?? "";

  return {
    carrierCode,
    carrierName: segment.marketing_carrier.name ?? null,
    // Duffel gives the bare number; the rest of the app expects it carrier-prefixed.
    flightNumber: number ? `${carrierCode}${number}` : carrierCode,
    aircraft: segment.aircraft?.name ?? null,
    from: {
      code: segment.origin.iata_code ?? "",
      terminal: segment.origin_terminal ?? null,
      at: segment.departing_at,
    },
    to: {
      code: segment.destination.iata_code ?? "",
      terminal: segment.destination_terminal ?? null,
      at: segment.arriving_at,
    },
    // Duffel's own duration where it has one; otherwise from the timestamps,
    // which it always has.
    durationMinutes:
      parseIsoDuration(segment.duration ?? undefined) ||
      minutesBetween(segment.departing_at, segment.arriving_at),
  };
}

function normalizeSlice(slice: DuffelOffer["slices"][number]): Itinerary {
  const segments = slice.segments.map(normalizeSegment);
  const first = slice.segments[0];
  const last = slice.segments.at(-1);

  const duration =
    parseIsoDuration(slice.duration ?? undefined) ||
    (first && last ? minutesBetween(first.departing_at, last.arriving_at) : 0);

  return { durationMinutes: duration, segments, stops: Math.max(0, segments.length - 1) };
}

/**
 * Baggage is per passenger per segment in Duffel, so the allowance for the trip
 * is the smallest any segment grants — a connecting flight that permits one bag
 * on the second leg permits one bag, whatever the first leg allowed.
 */
function normalizeBaggage(offer: DuffelOffer): BaggageAllowance {
  let checked: number | null = null;
  let cabin: number | null = null;

  for (const slice of offer.slices) {
    for (const segment of slice.segments) {
      for (const passenger of segment.passengers ?? []) {
        for (const bag of passenger.baggages ?? []) {
          if (bag.type === "checked") checked = checked === null ? bag.quantity : Math.min(checked, bag.quantity);
          if (bag.type === "carry_on") cabin = cabin === null ? bag.quantity : Math.min(cabin, bag.quantity);
        }
      }
    }
  }

  return { checkedBags: checked, cabinBags: cabin };
}

/**
 * Duffel says whether a refund is allowed and what it would cost, but not
 * always both. "Allowed" alone is what the rest of the app means by refundable;
 * the penalty belongs to the cancellation quote, not to this flag.
 */
function isRefundable(offer: DuffelOffer): boolean {
  return offer.conditions?.refund_before_departure?.allowed === true;
}

/**
 * Duffel prices an offer in the airline's settlement currency, which is not
 * always one we sell in.
 *
 * An offer in a currency we do not support is dropped, not converted: we hold
 * no exchange rate, and inventing one would quote a price we cannot charge.
 * Losing an offer is a worse search; quoting an unconvertible one is a booking
 * that fails at payment.
 */
function supportedCurrency(value: string): CurrencyCode | null {
  const upper = value.toUpperCase();
  return (CURRENCIES as readonly string[]).includes(upper) ? (upper as CurrencyCode) : null;
}

export function normalizeFlightOffers(
  offers: DuffelOffer[],
  ttlMs: number,
): NormalizedFlightOffer[] {
  const fallbackExpiry = new Date(Date.now() + ttlMs).toISOString();

  return offers.flatMap((offer) => {
    const currency = supportedCurrency(offer.total_currency);
    if (!currency) return [];

    const total = offer.total_amount;
    // Duffel splits base and tax; where it does not, the whole amount is base
    // rather than a guessed split.
    const base = offer.base_amount ?? total;
    const tax = offer.tax_amount ?? (Number(total) - Number(base)).toFixed(2);

    return [{
      offerId: `duffel:${offer.id}`,
      supplierId: "duffel" as const,
      supplierOfferRef: offer.id,
      itineraries: offer.slices.map(normalizeSlice),
      netPrice: { amount: total, currency },
      fareBreakdown: { base, taxesAndFees: tax, total },
      baggage: normalizeBaggage(offer),
      refundable: isRefundable(offer),
      // Duffel publishes no seat count on an offer. Null, not a guess: the
      // results page only shows "only N left" when it actually knows.
      seatsRemaining: null,
      validatingCarrier: offer.owner?.iata_code ?? null,
      // Duffel offers expire on their own schedule, usually well inside our
      // cache TTL, so its expiry wins where it gives one.
      expiresAt: offer.expires_at ?? fallbackExpiry,
      bookable: true,
      bookingUrl: null,
      supplierPayload: { offerId: offer.id },
    }];
  });
}

const PLACE_TYPES: Record<PlaceKind, ReadonlySet<string>> = {
  airport: new Set(["airport"]),
  city: new Set(["city"]),
  any: new Set(["airport", "city"]),
};

export function normalizePlaces(raw: unknown, kind: PlaceKind): NormalizedPlace[] {
  const parsed = placeSuggestionsSchema.safeParse(raw);
  if (!parsed.success) return [];

  return parsed.data.data
    .filter((place) => place.iata_code !== null && PLACE_TYPES[kind].has(place.type))
    .map((place) => ({
      code: place.iata_code as string,
      name: place.name,
      cityName: place.city_name ?? null,
      countryCode: place.iata_country_code ?? null,
      kind: place.type === "city" ? ("city" as const) : ("airport" as const),
    }));
}
