import { SupplierError } from "../errors";
import type {
  FlightSearchParams,
  PricedOffer,
  HotelSearchParams,
  NormalizedFlightOffer,
  NormalizedHotelOffer,
  NormalizedPlace,
  PlaceKind,
  SupplierAdapter,
} from "../types";
import { amadeusGet, amadeusPost, readCredentials, type AmadeusCredentials } from "./client";
import {
  flightOffersResponseSchema,
  locationsResponseSchema,
  pricingResponseSchema,
} from "./schemas";
import { hotelOffersResponseSchema, hotelsByCityResponseSchema } from "./hotel-schemas";
import { normalizeFlightOffers, normalizePlaces } from "./normalize";
import { indexHotelDetails, normalizeHotelOffers } from "./normalize-hotels";

/** How long a returned offer stays quotable before re-pricing is required. */
const OFFER_TTL_MS = 10 * 60_000;

const SUB_TYPE: Record<PlaceKind, string> = {
  airport: "AIRPORT",
  city: "CITY",
  any: "AIRPORT,CITY",
};

export class AmadeusAdapter implements SupplierAdapter {
  readonly id = "amadeus" as const;
  readonly capabilities = {
    flights: true,
    hotels: true,
    autocomplete: true,
    booking: true,
    cancellation: true,
  };

  private readonly credentials: AmadeusCredentials;

  constructor(credentials: AmadeusCredentials) {
    this.credentials = credentials;
  }

  /** Null when credentials are absent, so the registry can skip this supplier. */
  static create(): AmadeusAdapter | null {
    const credentials = readCredentials();
    return credentials ? new AmadeusAdapter(credentials) : null;
  }

  async autocomplete(query: string, kind: PlaceKind): Promise<NormalizedPlace[]> {
    const raw = await amadeusGet<unknown>(this.credentials, "/v1/reference-data/locations", {
      keyword: query,
      subType: SUB_TYPE[kind],
      "page[limit]": 10,
    });

    const parsed = locationsResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new SupplierError(this.id, "malformedResponse", "Unexpected locations response");
    }
    return normalizePlaces(parsed.data);
  }

  async searchFlights(params: FlightSearchParams): Promise<NormalizedFlightOffer[]> {
    const raw = await amadeusGet<unknown>(this.credentials, "/v2/shopping/flight-offers", {
      originLocationCode: params.origin,
      destinationLocationCode: params.destination,
      departureDate: params.departDate,
      returnDate: params.returnDate,
      adults: params.adults,
      children: params.children > 0 ? params.children : undefined,
      infants: params.infants > 0 ? params.infants : undefined,
      travelClass: params.cabin,
      currencyCode: params.currency,
      nonStop: params.nonStopOnly ? true : undefined,
      max: params.maxResults,
    });

    const parsed = flightOffersResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new SupplierError(
        this.id,
        "malformedResponse",
        `Unexpected flight-offers response: ${parsed.error.issues[0]?.message ?? "unknown"}`,
      );
    }

    return normalizeFlightOffers(
      parsed.data,
      params.currency,
      new Date(Date.now() + OFFER_TTL_MS).toISOString(),
    );
  }

  async searchHotels(params: HotelSearchParams): Promise<NormalizedHotelOffer[]> {
    // Two calls, because Amadeus splits the index from the availability:
    // by-city gives the hotels and their coordinates, hotel-offers gives the
    // prices for the ones we ask about.
    const rawList = await amadeusGet<unknown>(
      this.credentials,
      "/v1/reference-data/locations/hotels/by-city",
      { cityCode: params.cityCode, radius: 20, radiusUnit: "KM" },
    );

    const list = hotelsByCityResponseSchema.safeParse(rawList);
    if (!list.success) {
      throw new SupplierError(this.id, "malformedResponse", "Unexpected hotels-by-city response");
    }

    const hotelIds = list.data.data.slice(0, params.maxResults).map((hotel) => hotel.hotelId);
    if (hotelIds.length === 0) return [];

    const rawOffers = await amadeusGet<unknown>(this.credentials, "/v3/shopping/hotel-offers", {
      hotelIds: hotelIds.join(","),
      checkInDate: params.checkIn,
      checkOutDate: params.checkOut,
      adults: params.adults,
      roomQuantity: params.rooms,
      currency: params.currency,
    });

    const offers = hotelOffersResponseSchema.safeParse(rawOffers);
    if (!offers.success) {
      throw new SupplierError(this.id, "malformedResponse", "Unexpected hotel-offers response");
    }

    return normalizeHotelOffers(
      offers.data,
      indexHotelDetails(list.data),
      params.cityCode,
      params.currency,
      new Date(Date.now() + OFFER_TTL_MS).toISOString(),
    );
  }

  async confirmFlightPrice(offer: NormalizedFlightOffer): Promise<PricedOffer> {
    // Amadeus prices the whole offer object, not a reference to it — which is
    // why the raw payload is carried through from the search.
    const raw = await amadeusPost<unknown>(
      this.credentials,
      "/v1/shopping/flight-offers/pricing",
      { data: { type: "flight-offers-pricing", flightOffers: [offer.supplierPayload] } },
    );

    const parsed = pricingResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new SupplierError(this.id, "malformedResponse", "Unexpected pricing response");
    }

    const priced = parsed.data.data.flightOffers[0];
    if (!priced) {
      // The supplier answered but has nothing to sell: the fare is gone.
      return {
        offerId: offer.offerId,
        netPrice: offer.netPrice,
        fareBreakdown: offer.fareBreakdown,
        available: false,
        supplierPayload: offer.supplierPayload,
      };
    }

    const total = priced.price.grandTotal ?? priced.price.total;
    const base = priced.price.base ?? total;

    return {
      offerId: offer.offerId,
      netPrice: { amount: total, currency: offer.netPrice.currency },
      fareBreakdown: {
        base,
        taxesAndFees: (Number(total) - Number(base)).toFixed(2),
        total,
      },
      available: true,
      supplierPayload: priced,
    };
  }
}
