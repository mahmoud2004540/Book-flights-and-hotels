import { z } from "zod";

/** Amadeus hotel responses, validated before use. */

export const hotelByCitySchema = z.object({
  hotelId: z.string(),
  name: z.string(),
  iataCode: z.string().optional(),
  geoCode: z.object({ latitude: z.number(), longitude: z.number() }).optional(),
  address: z
    .object({ countryCode: z.string().optional(), lines: z.array(z.string()).optional() })
    .optional(),
  distance: z.object({ value: z.number(), unit: z.string() }).optional(),
  rating: z.string().optional(),
  amenities: z.array(z.string()).optional(),
});

export const hotelsByCityResponseSchema = z.object({
  data: z.array(hotelByCitySchema),
});

const policiesSchema = z.object({
  cancellations: z
    .array(z.object({ deadline: z.string().optional(), amount: z.string().optional() }))
    .optional(),
  refundable: z.object({ cancellationRefund: z.string().optional() }).optional(),
});

export const hotelOfferSchema = z.object({
  hotel: z.object({
    hotelId: z.string(),
    name: z.string().optional(),
    cityCode: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    rating: z.string().optional(),
    amenities: z.array(z.string()).optional(),
    media: z.array(z.object({ uri: z.string() })).optional(),
  }),
  available: z.boolean().optional(),
  offers: z.array(
    z.object({
      id: z.string(),
      room: z
        .object({
          typeEstimated: z.object({ bedType: z.string().optional() }).optional(),
          description: z.object({ text: z.string().optional() }).optional(),
        })
        .optional(),
      boardType: z.string().optional(),
      policies: policiesSchema.optional(),
      price: z.object({ currency: z.string(), total: z.string() }),
    }),
  ),
});

export const hotelOffersResponseSchema = z.object({
  data: z.array(hotelOfferSchema),
});

export type AmadeusHotelsByCity = z.infer<typeof hotelsByCityResponseSchema>;
export type AmadeusHotelOffers = z.infer<typeof hotelOffersResponseSchema>;
