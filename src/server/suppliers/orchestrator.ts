import { CACHE_TTL_SECONDS, SUPPLIER_TIMEOUTS } from "@/lib/config";
import { ServiceType } from "@prisma/client";
import { applyMarkup } from "@/server/pricing/markup";
import { cacheKey, readCache, writeCache } from "./cache";
import { isOpen, recordFailure, recordSuccess } from "./resilience/circuit-breaker";
import { withRetry } from "./resilience/retry";
import { flightAdapters } from "./registry";
import type {
  FlightSearchParams,
  NormalizedFlightOffer,
  PublicFlightOffer,
} from "./types";

/**
 * Queries every live supplier at once, merges what comes back, and prices it.
 *
 * Uses allSettled rather than all — section 3.3. One supplier failing must
 * degrade the result set, never empty it.
 */

export type SearchOutcome = {
  offers: PublicFlightOffer[];
  /** Which suppliers answered, so the UI can say the results are partial. */
  suppliersQueried: number;
  suppliersSucceeded: number;
  fromCache: boolean;
};

function dedupe(offers: NormalizedFlightOffer[]): NormalizedFlightOffer[] {
  // The same physical flight can come from several suppliers. Key on the route
  // and flight numbers so duplicates collapse to whichever is cheapest.
  const byRoute = new Map<string, NormalizedFlightOffer>();

  for (const offer of offers) {
    const signature = offer.itineraries
      .map((itinerary) =>
        itinerary.segments.map((s) => `${s.flightNumber}@${s.from.at}`).join(">"),
      )
      .join("|");

    const existing = byRoute.get(signature);
    if (!existing || Number(offer.netPrice.amount) < Number(existing.netPrice.amount)) {
      byRoute.set(signature, offer);
    }
  }

  return [...byRoute.values()];
}

async function toPublic(
  offers: NormalizedFlightOffer[],
  destination: string,
): Promise<PublicFlightOffer[]> {
  return Promise.all(
    offers.map(async (offer) => {
      const priced = await applyMarkup(offer.netPrice.amount, {
        supplierId: offer.supplierId,
        serviceType: ServiceType.FLIGHT,
        destination,
      });

      // netPrice is destructured away rather than deleted, so it cannot be
      // reintroduced by accident — the public type has no such field.
      const { netPrice: _netPrice, ...rest } = offer;
      return { ...rest, price: { amount: priced.total, currency: offer.netPrice.currency } };
    }),
  );
}

export async function searchFlights(params: FlightSearchParams): Promise<SearchOutcome> {
  const key = cacheKey("flights", { ...params });

  const cached = await readCache<NormalizedFlightOffer[]>(key);
  if (cached) {
    return {
      offers: await toPublic(cached, params.destination),
      suppliersQueried: 0,
      suppliersSucceeded: 0,
      fromCache: true,
    };
  }

  const adapters = await flightAdapters();
  const available = adapters.filter((adapter) => !isOpen(adapter.id));

  const settled = await Promise.allSettled(
    available.map(async (adapter) => {
      try {
        const result = await withRetry(() => adapter.searchFlights(params));
        recordSuccess(adapter.id);
        return result;
      } catch (error) {
        recordFailure(adapter.id, error);
        throw error;
      }
    }),
  );

  const merged: NormalizedFlightOffer[] = [];
  let succeeded = 0;

  for (const outcome of settled) {
    if (outcome.status === "fulfilled") {
      succeeded++;
      merged.push(...outcome.value);
    } else {
      console.error("Supplier search failed:", outcome.reason);
    }
  }

  const offers = dedupe(merged).sort(
    (a, b) => Number(a.netPrice.amount) - Number(b.netPrice.amount),
  );

  // Only a successful search is cached. Caching an empty result from a total
  // outage would keep serving "no flights" for the whole TTL.
  if (succeeded > 0) {
    await writeCache(key, "merged", offers, CACHE_TTL_SECONDS.flightSearch);
  }

  return {
    offers: await toPublic(offers, params.destination),
    suppliersQueried: available.length,
    suppliersSucceeded: succeeded,
    fromCache: false,
  };
}

export const SEARCH_BUDGET_MS = SUPPLIER_TIMEOUTS.totalSearchMs;
