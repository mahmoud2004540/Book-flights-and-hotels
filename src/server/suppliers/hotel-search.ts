import { CACHE_TTL_SECONDS } from "@/lib/config";
import { ServiceType } from "@prisma/client";
import { applyMarkup } from "@/server/pricing/markup";
import { cacheKey, readCache, writeCache } from "./cache";
import { isOpen, recordFailure, recordSuccess } from "./resilience/circuit-breaker";
import { withRetry } from "./resilience/retry";
import { flightAdapters } from "./registry";
import type {
  HotelSearchParams,
  NormalizedHotelOffer,
  PublicHotelOffer,
} from "./types";

/**
 * The hotel counterpart of the flight orchestrator — same rules:
 * every live supplier is queried at once, one failing degrades the results
 * rather than emptying them, and markup is applied before anything is returned.
 */

export type HotelSearchOutcome = {
  hotels: PublicHotelOffer[];
  suppliersQueried: number;
  suppliersSucceeded: number;
  fromCache: boolean;
};

function dedupe(hotels: NormalizedHotelOffer[]): NormalizedHotelOffer[] {
  // The same property can come from several suppliers. Keyed on the hotel id
  // so duplicates collapse to whichever quoted the cheapest room.
  const byHotel = new Map<string, NormalizedHotelOffer>();

  for (const hotel of hotels) {
    const existing = byHotel.get(hotel.hotelId);
    const cheapest = Number(hotel.rooms[0]?.netPrice.amount ?? Infinity);
    const incumbent = Number(existing?.rooms[0]?.netPrice.amount ?? Infinity);
    if (!existing || cheapest < incumbent) byHotel.set(hotel.hotelId, hotel);
  }

  return [...byHotel.values()];
}

async function toPublic(
  hotels: NormalizedHotelOffer[],
  cityCode: string,
): Promise<PublicHotelOffer[]> {
  return Promise.all(
    hotels.map(async (hotel) => {
      const rooms = await Promise.all(
        hotel.rooms.map(async (room) => {
          const priced = await applyMarkup(room.netPrice.amount, {
            supplierId: hotel.supplierId,
            serviceType: ServiceType.HOTEL,
            destination: cityCode,
          });
          const { netPrice: _netPrice, ...rest } = room;
          return { ...rest, price: { amount: priced.total, currency: room.netPrice.currency } };
        }),
      );

      const cheapest = rooms[0];
      return {
        ...hotel,
        rooms,
        fromPrice: cheapest?.price ?? { amount: "0.00", currency: "USD" as const },
      };
    }),
  );
}

export async function searchHotels(params: HotelSearchParams): Promise<HotelSearchOutcome> {
  const key = cacheKey("hotels", { ...params });

  const cached = await readCache<NormalizedHotelOffer[]>(key);
  if (cached) {
    return {
      hotels: await toPublic(cached, params.cityCode),
      suppliersQueried: 0,
      suppliersSucceeded: 0,
      fromCache: true,
    };
  }

  const adapters = (await flightAdapters()).filter(
    (adapter) => adapter.capabilities.hotels && !isOpen(adapter.id),
  );

  const settled = await Promise.allSettled(
    adapters.map(async (adapter) => {
      try {
        const result = await withRetry(() => adapter.searchHotels(params));
        recordSuccess(adapter.id);
        return result;
      } catch (error) {
        recordFailure(adapter.id, error);
        throw error;
      }
    }),
  );

  const merged: NormalizedHotelOffer[] = [];
  let succeeded = 0;

  for (const outcome of settled) {
    if (outcome.status === "fulfilled") {
      succeeded++;
      merged.push(...outcome.value);
    } else {
      console.error("Hotel search failed:", outcome.reason);
    }
  }

  const hotels = dedupe(merged).sort(
    (a, b) =>
      Number(a.rooms[0]?.netPrice.amount ?? 0) - Number(b.rooms[0]?.netPrice.amount ?? 0),
  );

  if (succeeded > 0) {
    await writeCache(key, "merged", hotels, CACHE_TTL_SECONDS.hotelSearch);
  }

  return {
    hotels: await toPublic(hotels, params.cityCode),
    suppliersQueried: adapters.length,
    suppliersSucceeded: succeeded,
    fromCache: false,
  };
}
