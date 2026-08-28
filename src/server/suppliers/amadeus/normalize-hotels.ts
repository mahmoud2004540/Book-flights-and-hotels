import type { CurrencyCode } from "@/lib/config";
import type {
  CancellationPolicy,
  Coordinates,
  NormalizedHotelOffer,
  RoomOffer,
} from "../types";
import type { AmadeusHotelOffers, AmadeusHotelsByCity } from "./hotel-schemas";

/** Converts Amadeus hotel shapes into ours. */

function starsFrom(rating: string | undefined): number | null {
  if (!rating) return null;
  const value = Number(rating);
  return Number.isFinite(value) && value >= 1 && value <= 5 ? value : null;
}

function cancellationFrom(
  policies: AmadeusHotelOffers["data"][number]["offers"][number]["policies"],
): CancellationPolicy {
  const first = policies?.cancellations?.[0];
  // Amadeus expresses "free until" as a deadline. No deadline and no explicit
  // refundable flag means we cannot promise a free cancellation, so we do not.
  return {
    refundable: policies?.refundable?.cancellationRefund === "REFUNDABLE_UP_TO_DEADLINE",
    deadline: first?.deadline ?? null,
  };
}

/** Geographic detail from the by-city index, keyed for merging into offers. */
export function indexHotelDetails(
  response: AmadeusHotelsByCity,
): Map<string, { coordinates: Coordinates | null; address: string | null; distanceKm: number | null }> {
  const map = new Map<
    string,
    { coordinates: Coordinates | null; address: string | null; distanceKm: number | null }
  >();

  for (const hotel of response.data) {
    map.set(hotel.hotelId, {
      coordinates: hotel.geoCode
        ? { latitude: hotel.geoCode.latitude, longitude: hotel.geoCode.longitude }
        : null,
      address: hotel.address?.lines?.join(", ") ?? null,
      // Amadeus reports distance in kilometres or miles depending on the request.
      distanceKm:
        hotel.distance?.unit === "MILE"
          ? Math.round(hotel.distance.value * 1.609 * 10) / 10
          : (hotel.distance?.value ?? null),
    });
  }

  return map;
}

export function normalizeHotelOffers(
  response: AmadeusHotelOffers,
  details: Map<string, { coordinates: Coordinates | null; address: string | null; distanceKm: number | null }>,
  cityCode: string,
  currency: CurrencyCode,
  expiresAt: string,
): NormalizedHotelOffer[] {
  return response.data
    .filter((entry) => entry.available !== false && entry.offers.length > 0)
    .map((entry) => {
      const detail = details.get(entry.hotel.hotelId);

      const rooms: RoomOffer[] = entry.offers.map((offer) => ({
        offerId: `amadeus:${offer.id}`,
        supplierOfferRef: offer.id,
        roomDescription: offer.room?.description?.text ?? null,
        bedType: offer.room?.typeEstimated?.bedType ?? null,
        boardType: offer.boardType ?? null,
        netPrice: { amount: offer.price.total, currency },
        cancellation: cancellationFrom(offer.policies),
      }));

      const coordinates =
        detail?.coordinates ??
        (entry.hotel.latitude !== undefined && entry.hotel.longitude !== undefined
          ? { latitude: entry.hotel.latitude, longitude: entry.hotel.longitude }
          : null);

      return {
        hotelId: entry.hotel.hotelId,
        supplierId: "amadeus" as const,
        name: entry.hotel.name ?? entry.hotel.hotelId,
        stars: starsFrom(entry.hotel.rating),
        guestRating: null,
        coordinates,
        address: detail?.address ?? null,
        cityCode: entry.hotel.cityCode ?? cityCode,
        distanceKm: detail?.distanceKm ?? null,
        amenities: entry.hotel.amenities ?? [],
        images: entry.hotel.media?.map((item) => item.uri) ?? [],
        rooms: rooms.sort((a, b) => Number(a.netPrice.amount) - Number(b.netPrice.amount)),
        expiresAt,
      };
    });
}
