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
  /**
   * Whether this fare can actually be bought here.
   *
   * False for a supplier that only publishes prices — Travelpayouts indexes
   * what fares have recently sold for and links out to whoever sells them; it
   * has no seat to hold and nothing to issue. Such an offer is honest as a
   * price signal and a lie as a booking, so it is marked rather than hidden,
   * and the booking flow refuses it.
   */
  bookable: boolean;
  /** Where to send someone for an offer we cannot sell. Null when bookable. */
  bookingUrl: string | null;
  /**
   * The supplier's own offer object, kept verbatim.
   *
   * Amadeus re-pricing requires the whole offer posted back, not an id, so
   * discarding this at normalization would make step 2 of the booking flow
   * impossible. It is server-side only — the public type omits it, so it can
   * never be serialised to the browser.
   */
  supplierPayload: unknown;
};

/** What the browser receives: the final price, with supplier internals removed. */
export type PublicFlightOffer = Omit<
  NormalizedFlightOffer,
  "netPrice" | "supplierPayload"
> & {
  price: Money;
};

/** The outcome of re-pricing an offer immediately before payment — section 4.5. */
export type PricedOffer = {
  offerId: string;
  /** The supplier's price now, which may differ from the searched price. */
  netPrice: Money;
  fareBreakdown: FareBreakdown;
  /** False when the supplier no longer sells this offer at all. */
  available: boolean;
  supplierPayload: unknown;
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
  /** Only called when capabilities.hotels is true. */
  searchHotels(params: HotelSearchParams): Promise<NormalizedHotelOffer[]>;

  /**
   * Confirms what the offer costs right now. Called immediately before payment
   * and never skipped: fares move between search and checkout, and selling a
   * price the supplier no longer honours is the most common way a booking fails.
   */
  confirmFlightPrice(offer: NormalizedFlightOffer): Promise<PricedOffer>;
}

// ------------------------------------------------------------------- hotels

export type HotelSearchParams = {
  /** IATA city code, e.g. DXB — the unit Amadeus indexes hotels by. */
  cityCode: string;
  checkIn: string; // YYYY-MM-DD
  checkOut: string;
  adults: number;
  rooms: number;
  currency: CurrencyCode;
  maxResults: number;
};

export type Coordinates = { latitude: number; longitude: number };

export type CancellationPolicy = {
  refundable: boolean;
  /** ISO timestamp after which cancelling costs money. Null when unknown. */
  deadline: string | null;
};

export type RoomOffer = {
  offerId: string;
  supplierOfferRef: string;
  roomDescription: string | null;
  bedType: string | null;
  boardType: string | null;
  netPrice: Money;
  cancellation: CancellationPolicy;
};

export type NormalizedHotelOffer = {
  hotelId: string;
  supplierId: SupplierId;
  name: string;
  /** Star rating where the supplier provides one. */
  stars: number | null;
  guestRating: number | null;
  coordinates: Coordinates | null;
  address: string | null;
  cityCode: string;
  distanceKm: number | null;
  amenities: string[];
  images: string[];
  rooms: RoomOffer[];
  expiresAt: string;
};

/** What the browser receives: room prices with markup applied, net removed. */
export type PublicRoomOffer = Omit<RoomOffer, "netPrice"> & { price: Money };

export type PublicHotelOffer = Omit<NormalizedHotelOffer, "rooms"> & {
  rooms: PublicRoomOffer[];
  /** The cheapest room, lifted out so cards and sorting do not recompute it. */
  fromPrice: Money;
};
