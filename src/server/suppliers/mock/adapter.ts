import type {
  FlightSearchParams,
  Itinerary,
  NormalizedFlightOffer,
  NormalizedPlace,
  PlaceKind,
  Segment,
  SupplierAdapter,
} from "../types";
import { AIRCRAFT, AIRPORTS, CARRIERS } from "./data";

/**
 * A stand-in supplier for integration and end-to-end tests — section 12.
 *
 * TESTS ONLY. The registry will not construct this unless
 * SUPPLIER_MOCK_ENABLED is true, and the environment validator rejects that
 * value in production, so it cannot reach a real traveller.
 *
 * Results are deterministic for a given search: the same query returns the
 * same offers in the same order, which is what makes a test assertion on a
 * price or a duration meaningful.
 */

/** A small deterministic hash, so a search always produces the same results. */
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

function addMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

export class MockAdapter implements SupplierAdapter {
  readonly id = "amadeus" as const;
  readonly capabilities = {
    flights: true,
    hotels: false,
    autocomplete: true,
    booking: false,
    cancellation: false,
  };

  async autocomplete(query: string, kind: PlaceKind): Promise<NormalizedPlace[]> {
    const needle = query.trim().toLowerCase();
    if (needle.length === 0) return [];

    return AIRPORTS.filter(
      (airport) =>
        airport.code.toLowerCase().startsWith(needle) ||
        airport.city.toLowerCase().includes(needle) ||
        airport.name.toLowerCase().includes(needle),
    )
      .slice(0, 10)
      .map((airport) => ({
        code: airport.code,
        kind: kind === "city" ? ("city" as const) : ("airport" as const),
        name: airport.name,
        cityName: airport.city,
        countryCode: airport.country,
      }));
  }

  async searchFlights(params: FlightSearchParams): Promise<NormalizedFlightOffer[]> {
    const key = `${params.origin}${params.destination}${params.departDate}${params.cabin}`;
    const random = nextRandom(seedFrom(key));
    const count = Math.min(params.maxResults, 12);
    const offers: NormalizedFlightOffer[] = [];

    for (let index = 0; index < count; index++) {
      const carrier = CARRIERS[Math.floor(random() * CARRIERS.length)] ?? CARRIERS[0];
      const stops = params.nonStopOnly ? 0 : Math.floor(random() * 3) === 0 ? 1 : 0;
      const departAt = `${params.departDate}T${String(5 + Math.floor(random() * 17)).padStart(2, "0")}:${random() > 0.5 ? "30" : "00"}:00`;

      const outbound = this.buildItinerary(params.origin, params.destination, departAt, stops, carrier, random);
      const itineraries: Itinerary[] = [outbound];

      if (params.returnDate) {
        const returnAt = `${params.returnDate}T${String(7 + Math.floor(random() * 14)).padStart(2, "0")}:00:00`;
        itineraries.push(
          this.buildItinerary(params.destination, params.origin, returnAt, stops, carrier, random),
        );
      }

      const passengers = params.adults + params.children;
      const perPassenger = 120 + Math.floor(random() * 480) + (params.cabin === "BUSINESS" ? 900 : 0);
      const base = perPassenger * Math.max(passengers, 1);
      const taxes = Math.round(base * 0.18);

      offers.push({
        offerId: `mock:${key}:${index}`,
        supplierId: "amadeus",
        supplierOfferRef: `MOCK-${index}`,
        itineraries,
        netPrice: { amount: (base + taxes).toFixed(2), currency: params.currency },
        fareBreakdown: {
          base: base.toFixed(2),
          taxesAndFees: taxes.toFixed(2),
          total: (base + taxes).toFixed(2),
        },
        baggage: { checkedBags: stops === 0 ? 1 : 2, cabinBags: 1 },
        refundable: random() > 0.7,
        seatsRemaining: 1 + Math.floor(random() * 9),
        validatingCarrier: carrier.code,
        expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
      });
    }

    return offers.sort((a, b) => Number(a.netPrice.amount) - Number(b.netPrice.amount));
  }

  private buildItinerary(
    from: string,
    to: string,
    departAt: string,
    stops: number,
    carrier: { code: string; name: string },
    random: () => number,
  ): Itinerary {
    const legDuration = 90 + Math.floor(random() * 300);
    const segments: Segment[] = [];

    if (stops === 0) {
      segments.push(this.buildSegment(from, to, departAt, legDuration, carrier, random));
    } else {
      const hub = AIRPORTS[Math.floor(random() * AIRPORTS.length)] ?? AIRPORTS[0];
      const first = Math.round(legDuration * 0.55);
      const layover = 45 + Math.floor(random() * 120);
      segments.push(this.buildSegment(from, hub.code, departAt, first, carrier, random));
      segments.push(
        this.buildSegment(
          hub.code,
          to,
          addMinutes(departAt, first + layover),
          legDuration - first,
          carrier,
          random,
        ),
      );
    }

    const total = segments.reduce((sum, s) => sum + s.durationMinutes, 0);
    const spread =
      new Date(segments[segments.length - 1]!.to.at).getTime() -
      new Date(segments[0]!.from.at).getTime();

    return {
      durationMinutes: Math.round(spread / 60_000) || total,
      segments,
      stops: segments.length - 1,
    };
  }

  private buildSegment(
    from: string,
    to: string,
    departAt: string,
    durationMinutes: number,
    carrier: { code: string; name: string },
    random: () => number,
  ): Segment {
    return {
      carrierCode: carrier.code,
      carrierName: carrier.name,
      flightNumber: `${carrier.code}${100 + Math.floor(random() * 899)}`,
      aircraft: AIRCRAFT[Math.floor(random() * AIRCRAFT.length)] ?? null,
      from: { code: from, terminal: null, at: departAt },
      to: { code: to, terminal: null, at: addMinutes(departAt, durationMinutes) },
      durationMinutes,
    };
  }
}
