import { z } from "zod";

/**
 * Amadeus responses are validated before use rather than trusted.
 *
 * A supplier changing a field shape should fail here with a clear message,
 * not surface three layers up as an undefined price on a results card.
 */

const segmentSchema = z.object({
  carrierCode: z.string(),
  number: z.string(),
  aircraft: z.object({ code: z.string() }).optional(),
  departure: z.object({
    iataCode: z.string(),
    terminal: z.string().optional(),
    at: z.string(),
  }),
  arrival: z.object({
    iataCode: z.string(),
    terminal: z.string().optional(),
    at: z.string(),
  }),
  duration: z.string().optional(),
  numberOfStops: z.number().optional(),
});

const itinerarySchema = z.object({
  duration: z.string().optional(),
  segments: z.array(segmentSchema).min(1),
});

const fareDetailSchema = z.object({
  cabin: z.string().optional(),
  includedCheckedBags: z.object({ quantity: z.number().optional() }).optional(),
  includedCabinBags: z.object({ quantity: z.number().optional() }).optional(),
});

const travelerPricingSchema = z.object({
  fareDetailsBySegment: z.array(fareDetailSchema).optional(),
});

export const flightOfferSchema = z.object({
  id: z.string(),
  numberOfBookableSeats: z.number().optional(),
  validatingAirlineCodes: z.array(z.string()).optional(),
  lastTicketingDate: z.string().optional(),
  pricingOptions: z.object({ refundableFare: z.boolean().optional() }).optional(),
  itineraries: z.array(itinerarySchema).min(1),
  price: z.object({
    currency: z.string(),
    total: z.string(),
    base: z.string().optional(),
    grandTotal: z.string().optional(),
  }),
  travelerPricings: z.array(travelerPricingSchema).optional(),
});

export const flightOffersResponseSchema = z.object({
  data: z.array(flightOfferSchema),
  dictionaries: z
    .object({ carriers: z.record(z.string(), z.string()).optional() })
    .optional(),
});

export const locationSchema = z.object({
  subType: z.string(),
  name: z.string(),
  iataCode: z.string().optional(),
  address: z
    .object({
      cityName: z.string().optional(),
      countryCode: z.string().optional(),
    })
    .optional(),
});

export const locationsResponseSchema = z.object({
  data: z.array(locationSchema),
});

export type AmadeusFlightOffer = z.infer<typeof flightOfferSchema>;
export type AmadeusFlightOffersResponse = z.infer<typeof flightOffersResponseSchema>;
export type AmadeusLocationsResponse = z.infer<typeof locationsResponseSchema>;

/** The confirmed-price response — POST /v1/shopping/flight-offers/pricing. */
export const pricingResponseSchema = z.object({
  data: z.object({
    flightOffers: z.array(flightOfferSchema),
  }),
});
