import { z } from "zod";

/**
 * Travelpayouts' "prices for dates" response.
 *
 * Note what this API is, because it decides how the adapter treats it: an
 * index of what fares have recently been seen for a route, not live
 * availability. There is no seat behind a row here and no offer to hold, which
 * is why every offer built from it is marked unbookable.
 */
export const pricesForDatesSchema = z.object({
  success: z.boolean(),
  currency: z.string().nullish(),
  data: z
    .array(
      z.object({
        origin: z.string(),
        destination: z.string(),
        origin_airport: z.string().nullish(),
        destination_airport: z.string().nullish(),
        /** A number here, unlike every other supplier — see the normalizer. */
        price: z.number(),
        airline: z.string().nullish(),
        flight_number: z.union([z.string(), z.number()]).nullish(),
        departure_at: z.string(),
        return_at: z.string().nullish(),
        transfers: z.number().nullish(),
        duration: z.number().nullish(),
        duration_to: z.number().nullish(),
        /** Relative path on the partner site, carrying our marker. */
        link: z.string().nullish(),
      }),
    )
    .default([]),
});

export type PricesForDates = z.infer<typeof pricesForDatesSchema>;
