import type { PublicFlightOffer } from "@/server/suppliers/types";

/** Sorting and filtering shared by the results page and its controls. */

export type SortKey = "cheapest" | "fastest" | "best";

export type Filters = {
  maxPrice: number | null;
  maxStops: number | null;
  carriers: string[];
};

export const EMPTY_FILTERS: Filters = { maxPrice: null, maxStops: null, carriers: [] };

export function totalDuration(offer: PublicFlightOffer): number {
  return offer.itineraries.reduce((sum, itinerary) => sum + itinerary.durationMinutes, 0);
}

export function maxStops(offer: PublicFlightOffer): number {
  return Math.max(...offer.itineraries.map((itinerary) => itinerary.stops));
}

export function carriersOf(offer: PublicFlightOffer): string[] {
  const codes = new Set<string>();
  for (const itinerary of offer.itineraries) {
    for (const segment of itinerary.segments) codes.add(segment.carrierCode);
  }
  return [...codes];
}

/**
 * "Best" balances price against duration rather than optimising either alone:
 * the cheapest flight is often a 20-hour routing, and the fastest is often
 * three times the price. Both are normalised to the current result set so the
 * weighting means the same thing on a two-hour hop and a long-haul.
 */
function bestScore(offer: PublicFlightOffer, cheapest: number, quickest: number): number {
  const priceRatio = Number(offer.price.amount) / cheapest;
  const timeRatio = totalDuration(offer) / quickest;
  return priceRatio * 0.65 + timeRatio * 0.35;
}

export function sortOffers(
  offers: PublicFlightOffer[],
  key: SortKey,
): PublicFlightOffer[] {
  const copy = [...offers];

  if (key === "cheapest") {
    return copy.sort((a, b) => Number(a.price.amount) - Number(b.price.amount));
  }
  if (key === "fastest") {
    return copy.sort((a, b) => totalDuration(a) - totalDuration(b));
  }

  const cheapest = Math.min(...offers.map((o) => Number(o.price.amount))) || 1;
  const quickest = Math.min(...offers.map(totalDuration)) || 1;
  return copy.sort((a, b) => bestScore(a, cheapest, quickest) - bestScore(b, cheapest, quickest));
}

export function applyFilters(
  offers: PublicFlightOffer[],
  filters: Filters,
): PublicFlightOffer[] {
  return offers.filter((offer) => {
    if (filters.maxPrice !== null && Number(offer.price.amount) > filters.maxPrice) return false;
    if (filters.maxStops !== null && maxStops(offer) > filters.maxStops) return false;
    if (filters.carriers.length > 0) {
      const codes = carriersOf(offer);
      if (!filters.carriers.some((code) => codes.includes(code))) return false;
    }
    return true;
  });
}

/** The carrier list for the filter panel, with how many offers each one has. */
export function carrierCounts(
  offers: PublicFlightOffer[],
): Array<{ code: string; name: string; count: number }> {
  const map = new Map<string, { name: string; count: number }>();

  for (const offer of offers) {
    for (const itinerary of offer.itineraries) {
      for (const segment of itinerary.segments) {
        const existing = map.get(segment.carrierCode);
        if (existing) existing.count += 1;
        else map.set(segment.carrierCode, { name: segment.carrierName ?? segment.carrierCode, count: 1 });
      }
    }
  }

  return [...map.entries()]
    .map(([code, value]) => ({ code, ...value }))
    .sort((a, b) => b.count - a.count);
}

export function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

export function formatDayOffset(fromIso: string, toIso: string): string {
  const days = Math.round(
    (new Date(toIso).setUTCHours(0, 0, 0, 0) - new Date(fromIso).setUTCHours(0, 0, 0, 0)) / 86_400_000,
  );
  return days > 0 ? `+${days}` : "";
}
