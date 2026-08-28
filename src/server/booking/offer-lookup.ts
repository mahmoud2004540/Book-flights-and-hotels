import { ServiceType } from "@prisma/client";
import { applyMarkup } from "@/server/pricing/markup";
import { cacheKey, readCache } from "@/server/suppliers/cache";
import { searchFlights } from "@/server/suppliers/orchestrator";
import type { FlightSearchParams, Money, NormalizedFlightOffer } from "@/server/suppliers/types";

/**
 * Recovers the full server-side offer for a chosen offerId.
 *
 * The browser only ever holds the public offer, which has neither the net
 * price nor the supplier payload, so both are read back from the search cache
 * here. If the cache has expired the search is re-run, because a traveller who
 * paused on the results page should not hit a dead end.
 */
export async function findOfferForBooking(
  offerId: string,
  params: FlightSearchParams,
): Promise<{ offer: NormalizedFlightOffer; publicPrice: Money } | null> {
  const key = cacheKey("flights", { ...params });
  let offers = await readCache<NormalizedFlightOffer[]>(key);

  if (!offers) {
    const refreshed = await searchFlights(params);
    if (refreshed.offers.length === 0) return null;
    offers = await readCache<NormalizedFlightOffer[]>(key);
    if (!offers) return null;
  }

  const offer = offers.find((candidate) => candidate.offerId === offerId);
  if (!offer) return null;

  const priced = await applyMarkup(offer.netPrice.amount, {
    supplierId: offer.supplierId,
    serviceType: ServiceType.FLIGHT,
    destination: params.destination,
  });

  return {
    offer,
    publicPrice: { amount: priced.total, currency: offer.netPrice.currency },
  };
}
