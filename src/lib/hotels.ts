import type { PublicHotelOffer } from "@/server/suppliers/types";

/** Sorting and filtering for hotel results — section 4.3. */

export type HotelSortKey = "cheapest" | "rating" | "distance";

export type HotelFilters = {
  maxPrice: number | null;
  minStars: number | null;
  amenities: string[];
  freeCancellation: boolean;
};

export const EMPTY_HOTEL_FILTERS: HotelFilters = {
  maxPrice: null,
  minStars: null,
  amenities: [],
  freeCancellation: false,
};

/** Supplier amenity codes are shouted constants; these are the readable names. */
export const AMENITY_LABELS: Record<string, string> = {
  WIFI: "Wi-Fi",
  SWIMMING_POOL: "Pool",
  PARKING: "Parking",
  FITNESS_CENTER: "Gym",
  RESTAURANT: "Restaurant",
  SPA: "Spa",
  AIRPORT_SHUTTLE: "Airport shuttle",
  BUSINESS_CENTER: "Business centre",
  PETS_ALLOWED: "Pets allowed",
  BREAKFAST: "Breakfast",
};

export function amenityLabel(code: string): string {
  return AMENITY_LABELS[code] ?? code.toLowerCase().replace(/_/g, " ");
}

export function hasFreeCancellation(hotel: PublicHotelOffer): boolean {
  return hotel.rooms.some((room) => room.cancellation.refundable);
}

export function sortHotels(
  hotels: PublicHotelOffer[],
  key: HotelSortKey,
): PublicHotelOffer[] {
  const copy = [...hotels];

  if (key === "cheapest") {
    return copy.sort((a, b) => Number(a.fromPrice.amount) - Number(b.fromPrice.amount));
  }
  if (key === "distance") {
    // Hotels with no distance sort last rather than first, which is what a
    // plain numeric comparison on null would do.
    return copy.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
  }
  return copy.sort((a, b) => (b.guestRating ?? 0) - (a.guestRating ?? 0));
}

export function filterHotels(
  hotels: PublicHotelOffer[],
  filters: HotelFilters,
): PublicHotelOffer[] {
  return hotels.filter((hotel) => {
    if (filters.maxPrice !== null && Number(hotel.fromPrice.amount) > filters.maxPrice) {
      return false;
    }
    if (filters.minStars !== null && (hotel.stars ?? 0) < filters.minStars) return false;
    if (filters.freeCancellation && !hasFreeCancellation(hotel)) return false;
    if (filters.amenities.length > 0) {
      // Every selected amenity must be present — a traveller who ticks both
      // "pool" and "parking" wants both, not either.
      if (!filters.amenities.every((code) => hotel.amenities.includes(code))) return false;
    }
    return true;
  });
}

/** Amenities present in the current results, with counts, for the filter panel. */
export function amenityCounts(
  hotels: PublicHotelOffer[],
): Array<{ code: string; label: string; count: number }> {
  const counts = new Map<string, number>();
  for (const hotel of hotels) {
    for (const code of hotel.amenities) {
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([code, count]) => ({ code, label: amenityLabel(code), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}
