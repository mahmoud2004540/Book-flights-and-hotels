import type { CurrencyCode } from "@/lib/config";
import type {
  BaggageAllowance,
  Itinerary,
  NormalizedFlightOffer,
  NormalizedPlace,
  Segment,
} from "../types";
import type {
  AmadeusFlightOffersResponse,
  AmadeusLocationsResponse,
} from "./schemas";

/**
 * Converts Amadeus shapes into our own. This file is the only place that
 * knows what an Amadeus response looks like.
 */

/** Amadeus expresses durations as ISO 8601, e.g. "PT7H35M". */
export function parseIsoDuration(value: string | undefined): number {
  if (!value) return 0;
  const match = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/.exec(value);
  if (!match) return 0;

  const days = Number(match[1] ?? 0);
  const hours = Number(match[2] ?? 0);
  const minutes = Number(match[3] ?? 0);
  return days * 1440 + hours * 60 + minutes;
}

function normalizeSegment(
  segment: AmadeusFlightOffersResponse["data"][number]["itineraries"][number]["segments"][number],
  carriers: Record<string, string> | undefined,
): Segment {
  return {
    carrierCode: segment.carrierCode,
    carrierName: carriers?.[segment.carrierCode] ?? null,
    flightNumber: `${segment.carrierCode}${segment.number}`,
    aircraft: segment.aircraft?.code ?? null,
    from: {
      code: segment.departure.iataCode,
      terminal: segment.departure.terminal ?? null,
      at: segment.departure.at,
    },
    to: {
      code: segment.arrival.iataCode,
      terminal: segment.arrival.terminal ?? null,
      at: segment.arrival.at,
    },
    durationMinutes: parseIsoDuration(segment.duration),
  };
}

function baggageFrom(
  offer: AmadeusFlightOffersResponse["data"][number],
): BaggageAllowance {
  const first = offer.travelerPricings?.[0]?.fareDetailsBySegment?.[0];
  return {
    checkedBags: first?.includedCheckedBags?.quantity ?? null,
    cabinBags: first?.includedCabinBags?.quantity ?? null,
  };
}

export function normalizeFlightOffers(
  response: AmadeusFlightOffersResponse,
  currency: CurrencyCode,
  expiresAt: string,
): NormalizedFlightOffer[] {
  const carriers = response.dictionaries?.carriers;

  return response.data.map((offer) => {
    const itineraries: Itinerary[] = offer.itineraries.map((itinerary) => {
      const segments = itinerary.segments.map((s) => normalizeSegment(s, carriers));
      const summed = segments.reduce((total, s) => total + s.durationMinutes, 0);
      return {
        // The itinerary duration includes layovers; the segment sum does not,
        // so it is only a fallback when the supplier omits the total.
        durationMinutes: parseIsoDuration(itinerary.duration) || summed,
        segments,
        stops: segments.length - 1,
      };
    });

    const total = offer.price.grandTotal ?? offer.price.total;
    const base = offer.price.base ?? total;

    return {
      offerId: `amadeus:${offer.id}`,
      supplierId: "amadeus",
      supplierOfferRef: offer.id,
      itineraries,
      netPrice: { amount: total, currency },
      fareBreakdown: {
        base,
        taxesAndFees: (Number(total) - Number(base)).toFixed(2),
        total,
      },
      baggage: baggageFrom(offer),
      refundable: offer.pricingOptions?.refundableFare ?? false,
      seatsRemaining: offer.numberOfBookableSeats ?? null,
      validatingCarrier: offer.validatingAirlineCodes?.[0] ?? null,
      expiresAt,
      bookable: true,
      bookingUrl: null,
      supplierPayload: offer,
    };
  });
}

export function normalizePlaces(response: AmadeusLocationsResponse): NormalizedPlace[] {
  return response.data
    .filter((location) => location.iataCode !== undefined)
    .map((location) => ({
      code: location.iataCode as string,
      kind: location.subType === "CITY" ? ("city" as const) : ("airport" as const),
      name: location.name,
      cityName: location.address?.cityName ?? null,
      countryCode: location.address?.countryCode ?? null,
    }));
}
