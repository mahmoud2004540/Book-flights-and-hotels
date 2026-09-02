import { SUPPLIER_TIMEOUTS } from "@/lib/config";
import { SupplierError, classifyStatus } from "../errors";
import { withTimeout } from "../resilience/timeout";
import { logSupplierCall } from "../logging";
import type {
  FlightSearchParams,
  HotelSearchParams,
  NormalizedFlightOffer,
  NormalizedHotelOffer,
  NormalizedPlace,
  PricedOffer,
  SupplierAdapter,
} from "../types";
import { pricesForDatesSchema } from "./schemas";
import { normalizeIndexedFares } from "./normalize";

const SUPPLIER_ID = "travelpayouts";
const BASE_URL = "https://api.travelpayouts.com";
const OFFER_TTL_MS = 10 * 60_000;

type Credentials = { token: string; marker: string | undefined };

function readCredentials(): Credentials | null {
  const token = process.env.TRAVELPAYOUTS_TOKEN;
  if (!token) return null;
  return { token, marker: process.env.TRAVELPAYOUTS_MARKER };
}

/**
 * Travelpayouts — the cheapest headline prices, and none of them bookable here.
 *
 * It indexes what fares have recently sold for across the market, including
 * carriers and consolidators no booking API of ours reaches. That makes it
 * genuinely useful: when someone else is selling a route for less, a traveller
 * deserves to know rather than to find out later.
 *
 * What it is not is a way to sell a seat. There is no offer to hold, no price
 * to confirm and nothing to issue, so every offer it produces is marked
 * unbookable and carries a link out instead. confirmFlightPrice throws for the
 * same reason: nothing should ever reach it, and if something does, failing is
 * the correct answer rather than inventing a confirmation.
 */
export class TravelpayoutsAdapter implements SupplierAdapter {
  readonly id = "travelpayouts" as const;
  readonly capabilities = {
    flights: true,
    hotels: false,
    autocomplete: false,
    booking: false,
    cancellation: false,
  };

  private readonly credentials: Credentials;

  constructor(credentials: Credentials) {
    this.credentials = credentials;
  }

  static create(): TravelpayoutsAdapter | null {
    const credentials = readCredentials();
    return credentials ? new TravelpayoutsAdapter(credentials) : null;
  }

  async autocomplete(): Promise<NormalizedPlace[]> {
    return [];
  }

  async searchHotels(_params: HotelSearchParams): Promise<NormalizedHotelOffer[]> {
    return [];
  }

  async searchFlights(params: FlightSearchParams): Promise<NormalizedFlightOffer[]> {
    const query = new URLSearchParams({
      origin: params.origin,
      destination: params.destination,
      departure_at: params.departDate,
      currency: params.currency.toLowerCase(),
      sorting: "price",
      limit: String(Math.min(params.maxResults, 30)),
      one_way: params.returnDate ? "false" : "true",
      direct: params.nonStopOnly ? "true" : "false",
      token: this.credentials.token,
    });
    if (params.returnDate) query.set("return_at", params.returnDate);

    const endpoint = "/aviasales/v3/prices_for_dates";
    const started = Date.now();
    const response = await withTimeout(SUPPLIER_ID, SUPPLIER_TIMEOUTS.perRequestMs, (signal) =>
      // The token goes in a header as well as the query string: Travelpayouts
      // accepts either, and the header keeps it out of any log that records
      // the URL.
      fetch(`${BASE_URL}${endpoint}?${query}`, {
        headers: { "X-Access-Token": this.credentials.token, Accept: "application/json" },
        signal,
        cache: "no-store",
      }),
    );

    const durationMs = Date.now() - started;

    if (!response.ok) {
      const body = await response.text();
      logSupplierCall({
        supplierId: SUPPLIER_ID,
        endpoint,
        durationMs,
        statusCode: response.status,
        error: body,
      });
      throw new SupplierError(
        SUPPLIER_ID,
        classifyStatus(response.status),
        `${endpoint} failed: ${body.slice(0, 300)}`,
        response.status,
      );
    }

    logSupplierCall({ supplierId: SUPPLIER_ID, endpoint, durationMs, statusCode: 200 });

    const parsed = pricesForDatesSchema.safeParse(await response.json());
    if (!parsed.success) {
      throw new SupplierError(SUPPLIER_ID, "malformedResponse", "Unexpected prices response");
    }
    if (!parsed.data.success) {
      throw new SupplierError(SUPPLIER_ID, "invalidRequest", "Travelpayouts rejected the query");
    }

    return normalizeIndexedFares(
      parsed.data,
      params.currency,
      this.credentials.marker,
      OFFER_TTL_MS,
    );
  }

  async confirmFlightPrice(): Promise<PricedOffer> {
    // Unreachable by design: the booking flow refuses an unbookable offer
    // before it gets here. Throwing rather than returning a confirmation keeps
    // it that way — a price this supplier cannot honour must never be
    // presented as confirmed.
    throw new SupplierError(
      SUPPLIER_ID,
      "invalidRequest",
      "Travelpayouts publishes prices, not offers — nothing here can be booked",
    );
  }
}
