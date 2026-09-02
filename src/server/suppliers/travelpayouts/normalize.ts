import { CURRENCIES, type CurrencyCode } from "@/lib/config";
import type { Itinerary, NormalizedFlightOffer, Segment } from "../types";
import type { PricesForDates } from "./schemas";

/**
 * Converts Travelpayouts rows into our own shape.
 *
 * Two things this file will not do, both for the same reason — the row is a
 * price index entry, not an offer.
 *
 * It does not invent a fare breakdown. Travelpayouts publishes one number and
 * nothing about what is tax; splitting it would put a fabricated figure beside
 * real ones from other suppliers.
 *
 * It does not invent an itinerary. A row knows the route, the departure, the
 * carrier and how many transfers — not where they stop or when. So a
 * connecting fare becomes one segment marked with its stop count rather than a
 * plausible-looking routing nobody can fly.
 */

const PARTNER_BASE = "https://www.aviasales.com";

function supportedCurrency(value: string): CurrencyCode | null {
  const upper = value.toUpperCase();
  return (CURRENCIES as readonly string[]).includes(upper) ? (upper as CurrencyCode) : null;
}

function buildItinerary(row: PricesForDates["data"][number]): Itinerary {
  const departure = row.departure_at;
  const minutes = row.duration_to ?? row.duration ?? 0;
  const arrival = new Date(new Date(departure).getTime() + minutes * 60_000).toISOString();

  const carrier = row.airline ?? "";
  const number = row.flight_number === null || row.flight_number === undefined
    ? ""
    : String(row.flight_number);

  const segment: Segment = {
    carrierCode: carrier,
    carrierName: null,
    flightNumber: number ? `${carrier}${number}` : carrier,
    aircraft: null,
    from: { code: row.origin_airport ?? row.origin, terminal: null, at: departure },
    to: { code: row.destination_airport ?? row.destination, terminal: null, at: arrival },
    durationMinutes: minutes,
  };

  return {
    durationMinutes: minutes,
    segments: [segment],
    // The real stop count, even though there is only one segment to show it
    // on: the filters and the card both read this, and a connecting fare that
    // claims to be direct is the one lie that would actually mislead.
    stops: row.transfers ?? 0,
  };
}

export function normalizeIndexedFares(
  response: PricesForDates,
  fallbackCurrency: CurrencyCode,
  marker: string | undefined,
  ttlMs: number,
): NormalizedFlightOffer[] {
  const currency = supportedCurrency(response.currency ?? fallbackCurrency) ?? fallbackCurrency;
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();

  return response.data.flatMap((row, index) => {
    // Travelpayouts sends price as a JSON number. It is turned into a fixed
    // decimal string here and stays one everywhere after, so it can never
    // reach a Decimal column having been through binary floating point.
    const total = row.price.toFixed(2);
    if (Number(total) <= 0) return [];

    const link = row.link
      ? `${PARTNER_BASE}${row.link}${marker ? `${row.link.includes("?") ? "&" : "?"}marker=${encodeURIComponent(marker)}` : ""}`
      : null;

    return [
      {
        offerId: `travelpayouts:${row.origin}${row.destination}:${row.departure_at}:${index}`,
        supplierId: "travelpayouts" as const,
        supplierOfferRef: row.link ?? `${row.origin}-${row.destination}-${row.departure_at}`,
        itineraries: [buildItinerary(row)],
        netPrice: { amount: total, currency },
        // No split is published, so the whole amount is the base rather than a
        // guessed one. The public breakdown is rescaled from this anyway.
        fareBreakdown: { base: total, taxesAndFees: "0.00", total },
        baggage: { checkedBags: null, cabinBags: null },
        // Unknown, and unknown is not "no". A price index says nothing about
        // fare conditions.
        refundable: false,
        seatsRemaining: null,
        validatingCarrier: row.airline ?? null,
        expiresAt,
        bookable: false,
        bookingUrl: link,
        supplierPayload: { link: row.link ?? null },
      },
    ];
  });
}
