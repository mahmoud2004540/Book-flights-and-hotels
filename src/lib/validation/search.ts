import { z } from "zod";
import { CURRENCIES } from "@/lib/config";

/** An IATA code: exactly three letters, normalised to upper case. */
const iataCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, "Use a three-letter airport code");

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD")
  .refine((value) => !Number.isNaN(Date.parse(value)), "That is not a real date");

export const flightSearchSchema = z
  .object({
    origin: iataCode,
    destination: iataCode,
    departDate: isoDate,
    returnDate: isoDate.optional(),
    adults: z.coerce.number().int().min(1).max(9).default(1),
    children: z.coerce.number().int().min(0).max(8).default(0),
    infants: z.coerce.number().int().min(0).max(8).default(0),
    cabin: z
      .enum(["ECONOMY", "PREMIUM_ECONOMY", "BUSINESS", "FIRST"])
      .default("ECONOMY"),
    currency: z.enum(CURRENCIES).default("USD"),
    nonStopOnly: z.coerce.boolean().default(false),
    maxResults: z.coerce.number().int().min(1).max(50).default(30),
  })
  .refine((data) => data.origin !== data.destination, {
    message: "Origin and destination must be different",
    path: ["destination"],
  })
  .refine((data) => !data.returnDate || data.returnDate >= data.departDate, {
    message: "The return date cannot be before departure",
    path: ["returnDate"],
  })
  .refine((data) => data.infants <= data.adults, {
    // Airlines seat an infant on an adult's lap, so there cannot be more
    // infants than adults to hold them.
    message: "Each infant needs an accompanying adult",
    path: ["infants"],
  });

export type FlightSearchInput = z.infer<typeof flightSearchSchema>;

export const placesSearchSchema = z.object({
  q: z.string().trim().min(2, "Type at least two characters").max(60),
  kind: z.enum(["airport", "city", "any"]).default("any"),
});

export const hotelSearchSchema = z
  .object({
    cityCode: iataCode,
    checkIn: isoDate,
    checkOut: isoDate,
    adults: z.coerce.number().int().min(1).max(9).default(2),
    rooms: z.coerce.number().int().min(1).max(5).default(1),
    currency: z.enum(CURRENCIES).default("USD"),
    maxResults: z.coerce.number().int().min(1).max(50).default(30),
  })
  .refine((data) => data.checkOut > data.checkIn, {
    // Equal dates would be a zero-night stay, which no supplier will price.
    message: "Check-out must be after check-in",
    path: ["checkOut"],
  });

export type HotelSearchInput = z.infer<typeof hotelSearchSchema>;
