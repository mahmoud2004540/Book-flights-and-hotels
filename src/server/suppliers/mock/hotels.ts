import type {
  HotelSearchParams,
  NormalizedHotelOffer,
  RoomOffer,
} from "../types";

/**
 * Hotel fixtures for the mock adapter — TESTS ONLY.
 * See the warning in ./adapter.ts; this file is unreachable in production.
 */

/** City centres, so mock hotels scatter around a plausible point on the map. */
const CITY_CENTRES: Record<string, { lat: number; lng: number; label: string }> = {
  DXB: { lat: 25.2048, lng: 55.2708, label: "Dubai" },
  CAI: { lat: 30.0444, lng: 31.2357, label: "Cairo" },
  IST: { lat: 41.0082, lng: 28.9784, label: "Istanbul" },
  JED: { lat: 21.4858, lng: 39.1925, label: "Jeddah" },
  RUH: { lat: 24.7136, lng: 46.6753, label: "Riyadh" },
  LHR: { lat: 51.5074, lng: -0.1278, label: "London" },
  CDG: { lat: 48.8566, lng: 2.3522, label: "Paris" },
  DOH: { lat: 25.2854, lng: 51.531, label: "Doha" },
};

const BRANDS = [
  "Grand Plaza", "Marina View", "Continental", "The Regency", "Palm Residence",
  "City Lights", "Old Town Suites", "Harbour Court", "The Meridian", "Cedar House",
  "Azure Bay", "Northgate",
];

const AMENITY_POOL = [
  "WIFI", "SWIMMING_POOL", "PARKING", "FITNESS_CENTER", "RESTAURANT",
  "SPA", "AIRPORT_SHUTTLE", "BUSINESS_CENTER", "PETS_ALLOWED", "BREAKFAST",
];

const ROOM_TYPES = [
  { description: "Standard double room", bed: "DOUBLE", board: "ROOM_ONLY" },
  { description: "Deluxe king room with city view", bed: "KING", board: "BREAKFAST" },
  { description: "Twin room", bed: "TWIN", board: "ROOM_ONLY" },
  { description: "Executive suite", bed: "KING", board: "HALF_BOARD" },
];

function seedFrom(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function nextRandom(seed: number): () => number {
  let state = seed || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0xffffffff;
  };
}

function nightsBetween(checkIn: string, checkOut: string): number {
  const ms = new Date(`${checkOut}T00:00:00Z`).getTime() - new Date(`${checkIn}T00:00:00Z`).getTime();
  return Math.max(1, Math.round(ms / 86_400_000));
}

export function mockHotels(params: HotelSearchParams): NormalizedHotelOffer[] {
  const centre = CITY_CENTRES[params.cityCode] ?? { lat: 25.2, lng: 55.27, label: params.cityCode };
  const random = nextRandom(seedFrom(`${params.cityCode}${params.checkIn}${params.checkOut}`));
  const nights = nightsBetween(params.checkIn, params.checkOut);
  const count = Math.min(params.maxResults, BRANDS.length);
  const hotels: NormalizedHotelOffer[] = [];

  for (let index = 0; index < count; index++) {
    const stars = 2 + Math.floor(random() * 4);
    const nightly = 45 + Math.floor(random() * 60) * stars;

    const rooms: RoomOffer[] = ROOM_TYPES.slice(0, 1 + Math.floor(random() * 3)).map(
      (type, roomIndex) => {
        const total = (nightly + roomIndex * 35) * nights * params.rooms;
        const refundable = random() > 0.4;
        return {
          offerId: `mock-room:${index}:${roomIndex}`,
          supplierOfferRef: `MOCKROOM-${index}-${roomIndex}`,
          roomDescription: type.description,
          bedType: type.bed,
          boardType: type.board,
          netPrice: { amount: total.toFixed(2), currency: params.currency },
          cancellation: {
            refundable,
            deadline: refundable
              ? new Date(new Date(`${params.checkIn}T00:00:00Z`).getTime() - 86_400_000).toISOString()
              : null,
          },
        };
      },
    );

    // Scatter within roughly 5km of the centre so the map has spread.
    const latOffset = (random() - 0.5) * 0.09;
    const lngOffset = (random() - 0.5) * 0.09;

    hotels.push({
      hotelId: `MOCK${params.cityCode}${String(index).padStart(2, "0")}`,
      supplierId: "amadeus",
      name: `${BRANDS[index] ?? "Hotel"} ${centre.label}`,
      stars,
      guestRating: Math.round((6 + random() * 4) * 10) / 10,
      coordinates: { latitude: centre.lat + latOffset, longitude: centre.lng + lngOffset },
      address: `${1 + Math.floor(random() * 200)} ${centre.label} Road`,
      cityCode: params.cityCode,
      distanceKm: Math.round(Math.hypot(latOffset, lngOffset) * 111 * 10) / 10,
      amenities: AMENITY_POOL.filter(() => random() > 0.45),
      images: [],
      rooms: rooms.sort((a, b) => Number(a.netPrice.amount) - Number(b.netPrice.amount)),
      expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
    });
  }

  return hotels.sort(
    (a, b) => Number(a.rooms[0]?.netPrice.amount ?? 0) - Number(b.rooms[0]?.netPrice.amount ?? 0),
  );
}
