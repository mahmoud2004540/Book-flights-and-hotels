import type { CurrencyCode, SupplierId } from "@/lib/config";

/**
 * The single contract the rest of the application knows.
 * No supplier-specific shape is allowed to cross this boundary — everything
 * above it works with the normalized types below.
 */

// ------------------------------------------------------------------- money

export type Money = {
  /** Minor units are avoided here: fares carry two decimals and are read as text. */
  amount: string;
  currency: CurrencyCode;
};

export type FareBreakdown = {
  base: string;
  taxesAndFees: string;
  total: string;
};

// ------------------------------------------------------------------ places

export type PlaceKind = "airport" | "city" | "any";

export type NormalizedPlace = {
  /** IATA code — three letters for an airport, three for a city. */
  code: string;
  kind: "airport" | "city";
  name: string;
  cityName: string | null;
  countryCode: string | null;
};

// ------------------------------------------------------------------ search

export type CabinClass = "ECONOMY" | "PREMIUM_ECONOMY" | "BUSINESS" | "FIRST";

export type FlightSearchParams = {
  origin: string;
  destination: string;
  departDate: string; // YYYY-MM-DD
  returnDate?: string;
  adults: number;
  children: number;
  infants: number;
  cabin: CabinClass;
  currency: CurrencyCode;
  nonStopOnly: boolean;
  maxResults: number;
};

// ------------------------------------------------------------------ offers

export type Segment = {
  carrierCode: string;
  carrierName: string | null;
  flightNumber: string;
  aircraft: string | null;
  from: { code: string; terminal: string | null; at: string };
  to: { code: string; terminal: string | null; at: string };
  durationMinutes: number;
};

export type Itinerary = {
  durationMinutes: number;
  segments: Segment[];
  /** Segment count minus one — the number the results page filters on. */
  stops: number;
};

export type BaggageAllowance = {
  checkedBags: number | null;
  cabinBags: number | null;
};

export type NormalizedFlightOffer = {
  /** Our identifier, stable for the lifetime of the cached search. */
  offerId: string;
  supplierId: SupplierId;
  /** The supplier's own reference, needed for re-pricing and booking. */
  supplierOfferRef: string;
  itineraries: Itinerary[];
  /** What the supplier charges us. Never sent to the browser. */
  netPrice: Money;
  fareBreakdown: FareBreakdown;
  baggage: BaggageAllowance;
  refundable: boolean;
  seatsRemaining: number | null;
  validatingCarrier: string | null;
  expiresAt: string;
};

/** What the browser receives: the final price, with the supplier's cost removed. */
export type PublicFlightOffer = Omit<NormalizedFlightOffer, "netPrice"> & {
  price: Money;
};

// --------------------------------------------------------------- the adapter

export type SupplierCapabilities = {
  flights: boolean;
  hotels: boolean;
  autocomplete: boolean;
  booking: boolean;
  cancellation: boolean;
};

export interface SupplierAdapter {
  readonly id: SupplierId;
  readonly capabilities: SupplierCapabilities;

  autocomplete(query: string, kind: PlaceKind): Promise<NormalizedPlace[]>;
  searchFlights(params: FlightSearchParams): Promise<NormalizedFlightOffer[]>;
}
