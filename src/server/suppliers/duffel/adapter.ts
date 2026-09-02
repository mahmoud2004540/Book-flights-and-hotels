import { SupplierError } from "../errors";
import type {
  FlightSearchParams,
  HotelSearchParams,
  NormalizedFlightOffer,
  NormalizedHotelOffer,
  NormalizedPlace,
  PlaceKind,
  PricedOffer,
  SupplierAdapter,
} from "../types";
import { duffelGet, duffelPost, readCredentials, type DuffelCredentials } from "./client";
import { offerRequestResponseSchema, offerResponseSchema } from "./schemas";
import { normalizeFlightOffers, normalizePlaces } from "./normalize";

/** How long a returned offer stays quotable before re-pricing is required. */
const OFFER_TTL_MS = 10 * 60_000;

const CABIN: Record<FlightSearchParams["cabin"], string> = {
  ECONOMY: "economy",
  PREMIUM_ECONOMY: "premium_economy",
  BUSINESS: "business",
  FIRST: "first",
};

/**
 * Duffel — the supplier that lets us issue the ticket ourselves.
 *
 * Worth having beside Amadeus for two separate reasons. It reaches airlines
 * Amadeus does not, including low-cost carriers that sell nowhere else, so more
 * of the market is compared. And it makes us the merchant of record without an
 * IATA licence, which is what lets a booking finish here instead of handing the
 * traveller to another site.
 *
 * Written against Duffel's documented v2 shapes without a live key to try them
 * on. The schemas are strict for that reason: a field that differs fails the
 * parse, the circuit breaker drops this supplier, and the search still returns
 * results from the others — which is a far better failure than a price read out
 * of the wrong field.
 */
export class DuffelAdapter implements SupplierAdapter {
  readonly id = "duffel" as const;
  readonly capabilities = {
    flights: true,
    // Duffel sells stays, but under a separate product this adapter does not
    // implement. Claiming the capability would have the orchestrator ask for
    // hotels and get nothing.
    hotels: false,
    autocomplete: true,
    booking: true,
    cancellation: true,
  };

  private readonly credentials: DuffelCredentials;

  constructor(credentials: DuffelCredentials) {
    this.credentials = credentials;
  }

  /** Null when the token is absent, so the registry can skip this supplier. */
  static create(): DuffelAdapter | null {
    const credentials = readCredentials();
    return credentials ? new DuffelAdapter(credentials) : null;
  }

  async autocomplete(query: string, kind: PlaceKind): Promise<NormalizedPlace[]> {
    const raw = await duffelGet<unknown>(this.credentials, "/places/suggestions", { query });
    return normalizePlaces(raw, kind);
  }

  async searchFlights(params: FlightSearchParams): Promise<NormalizedFlightOffer[]> {
    const slices = [
      {
        origin: params.origin,
        destination: params.destination,
        departure_date: params.departDate,
      },
    ];
    if (params.returnDate) {
      slices.push({
        origin: params.destination,
        destination: params.origin,
        departure_date: params.returnDate,
      });
    }

    const passengers = [
      ...Array.from({ length: params.adults }, () => ({ type: "adult" })),
      ...Array.from({ length: params.children ?? 0 }, () => ({ type: "child" })),
      ...Array.from({ length: params.infants ?? 0 }, () => ({ type: "infant_without_seat" })),
    ];

    // return_offers=true asks Duffel to price the request in the same call.
    // Without it the offers arrive on a second request, which doubles the
    // latency of every search for nothing.
    const raw = await duffelPost<unknown>(
      this.credentials,
      "/air/offer_requests",
      { data: { slices, passengers, cabin_class: CABIN[params.cabin] } },
      { return_offers: "true", supplier_timeout: String(Math.min(20000, 15000)) },
    );

    const parsed = offerRequestResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new SupplierError(this.id, "malformedResponse", "Unexpected offer-request response");
    }

    return normalizeFlightOffers(parsed.data.data.offers, OFFER_TTL_MS).slice(0, params.maxResults);
  }

  async searchHotels(_params: HotelSearchParams): Promise<NormalizedHotelOffer[]> {
    // Unreachable: the orchestrator checks capabilities.hotels first. Present
    // because the interface requires it, and empty rather than throwing so a
    // future caller that forgets the check degrades instead of failing.
    return [];
  }

  async confirmFlightPrice(offer: NormalizedFlightOffer): Promise<PricedOffer> {
    // Duffel reprices by id — unlike Amadeus, which wants the whole offer
    // posted back — so the stored payload is only the reference.
    const reference = offer.supplierOfferRef;

    let raw: unknown;
    try {
      raw = await duffelGet<unknown>(this.credentials, `/air/offers/${reference}`);
    } catch (error) {
      // A gone fare is an answer, not a failure: the booking flow shows it and
      // offers a fresh search. 422 is how Duffel reports an offer that expired
      // between the search and this call, which is routine.
      const gone =
        error instanceof SupplierError &&
        (error.kind === "notFound" || error.statusCode === 422);
      if (gone) {
        return {
          offerId: offer.offerId,
          netPrice: offer.netPrice,
          fareBreakdown: offer.fareBreakdown,
          available: false,
          supplierPayload: offer.supplierPayload,
        };
      }
      throw error;
    }

    const parsed = offerResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new SupplierError(this.id, "malformedResponse", "Unexpected offer response");
    }

    const [priced] = normalizeFlightOffers([parsed.data.data], OFFER_TTL_MS);
    if (!priced) {
      // Normalization dropped it — an unsupported currency is the only way
      // that happens, and it is not something re-pricing can fix.
      return {
        offerId: offer.offerId,
        netPrice: offer.netPrice,
        fareBreakdown: offer.fareBreakdown,
        available: false,
        supplierPayload: offer.supplierPayload,
      };
    }

    return {
      offerId: offer.offerId,
      netPrice: priced.netPrice,
      fareBreakdown: priced.fareBreakdown,
      available: true,
      supplierPayload: priced.supplierPayload,
    };
  }
}
