import { SupplierError } from "../errors";
import type {
  FlightSearchParams,
  NormalizedFlightOffer,
  NormalizedPlace,
  PlaceKind,
  SupplierAdapter,
} from "../types";
import { amadeusGet, readCredentials, type AmadeusCredentials } from "./client";
import { flightOffersResponseSchema, locationsResponseSchema } from "./schemas";
import { normalizeFlightOffers, normalizePlaces } from "./normalize";

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
}
