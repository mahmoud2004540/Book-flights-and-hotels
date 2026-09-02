import { z } from "zod";

/**
 * The parts of Duffel's v2 responses this adapter reads.
 *
 * Deliberately narrow: unknown fields are ignored, but every field named here
 * must be present and the right type or parsing fails. That strictness is the
 * point. This adapter was written against Duffel's documented shapes without a
 * live key to try them on, so a mismatch has to surface as one loud
 * malformedResponse — which the circuit breaker turns into "skip this supplier"
 * while the rest of the search carries on — rather than as a price quietly read
 * out of the wrong field.
 *
 * Money arrives as decimal strings, and stays strings all the way to the
 * Decimal columns. Parsing it to a float here is how you lose a cent.
 */

const money = z.string().regex(/^-?\d+(\.\d+)?$/, "expected a decimal amount as a string");

const place = z.object({
  iata_code: z.string().nullable(),
  name: z.string().nullish(),
  city_name: z.string().nullish(),
  iata_city_code: z.string().nullish(),
  type: z.string().nullish(),
});

const segment = z.object({
  origin: place,
  destination: place,
  origin_terminal: z.string().nullish(),
  destination_terminal: z.string().nullish(),
  departing_at: z.string(),
  arriving_at: z.string(),
  duration: z.string().nullish(),
  marketing_carrier: z.object({ iata_code: z.string().nullish(), name: z.string().nullish() }),
  marketing_carrier_flight_number: z.string().nullish(),
  aircraft: z.object({ name: z.string().nullish() }).nullish(),
  passengers: z
    .array(
      z.object({
        baggages: z
          .array(z.object({ type: z.string(), quantity: z.number() }))
          .nullish(),
        cabin_class: z.string().nullish(),
      }),
    )
    .nullish(),
});

const slice = z.object({
  duration: z.string().nullish(),
  segments: z.array(segment).min(1),
});

export const offerSchema = z.object({
  id: z.string(),
  total_amount: money,
  total_currency: z.string(),
  base_amount: money.nullish(),
  tax_amount: money.nullish(),
  expires_at: z.string().nullish(),
  owner: z.object({ iata_code: z.string().nullish(), name: z.string().nullish() }).nullish(),
  slices: z.array(slice).min(1),
  /** Null where Duffel has no seat count, which is common and not an error. */
  available_services: z.unknown().nullish(),
  conditions: z
    .object({
      refund_before_departure: z
        .object({ allowed: z.boolean(), penalty_amount: money.nullish() })
        .nullish(),
      change_before_departure: z
        .object({ allowed: z.boolean(), penalty_amount: money.nullish() })
        .nullish(),
    })
    .nullish(),
  passenger_identity_documents_required: z.boolean().nullish(),
});

export type DuffelOffer = z.infer<typeof offerSchema>;

/** POST /air/offer_requests?return_offers=true */
export const offerRequestResponseSchema = z.object({
  data: z.object({
    id: z.string(),
    offers: z.array(offerSchema).default([]),
  }),
});

/** GET /air/offers/{id} — the same offer, repriced. */
export const offerResponseSchema = z.object({ data: offerSchema });

/** GET /places/suggestions?query=… */
export const placeSuggestionsSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      iata_code: z.string().nullable(),
      iata_country_code: z.string().nullish(),
      city_name: z.string().nullish(),
      type: z.string(),
    }),
  ),
});
