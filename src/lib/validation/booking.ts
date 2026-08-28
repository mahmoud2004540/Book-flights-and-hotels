import { z } from "zod";

/** Traveller and extras validation for the booking flow — section 4.5. */

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD")
  .refine((value) => !Number.isNaN(Date.parse(value)), "That is not a real date");

/** Whole years between a date of birth and a reference date. */
export function ageOn(dob: string, reference: string): number {
  const born = new Date(`${dob}T00:00:00Z`);
  const at = new Date(`${reference}T00:00:00Z`);
  let age = at.getUTCFullYear() - born.getUTCFullYear();
  const monthDelta = at.getUTCMonth() - born.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && at.getUTCDate() < born.getUTCDate())) age -= 1;
  return age;
}

export const passengerSchema = z.object({
  // Airlines match the ticket against the passport, so this is the passport
  // spelling, not a preferred name.
  firstName: z.string().trim().min(1, "Enter the first name as in the passport").max(60),
  lastName: z.string().trim().min(1, "Enter the last name as in the passport").max(60),
  dob: isoDate,
  nationality: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, "Use a two-letter country code"),
  passportNumber: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{5,15}$/, "Passport numbers are 5 to 15 letters and digits"),
  passportExpiry: isoDate,
  type: z.enum(["ADULT", "CHILD", "INFANT"]),
});

export const passengersSchema = z.object({
  departDate: isoDate,
  passengers: z.array(passengerSchema).min(1, "Add at least one traveller"),
});

export const extrasSchema = z.object({
  extraBags: z.coerce.number().int().min(0).max(5),
  seatSelection: z.coerce.boolean(),
  travelInsurance: z.coerce.boolean(),
});

export type PassengerInput = z.infer<typeof passengerSchema>;

export type PassengerIssue = { index: number; field: string; message: string };

/**
 * Rules that a per-field schema cannot express, because they depend on the
 * travel date or on the other travellers.
 */
export function validatePassengers(
  passengers: PassengerInput[],
  departDate: string,
): PassengerIssue[] {
  const issues: PassengerIssue[] = [];

  passengers.forEach((passenger, index) => {
    const age = ageOn(passenger.dob, departDate);

    if (age < 0) {
      issues.push({ index, field: "dob", message: "That date of birth is in the future" });
    } else if (passenger.type === "INFANT" && age >= 2) {
      issues.push({ index, field: "dob", message: "Infant fares are for under-2s on the travel date" });
    } else if (passenger.type === "CHILD" && (age < 2 || age >= 12)) {
      issues.push({ index, field: "dob", message: "Child fares are for ages 2 to 11 on the travel date" });
    } else if (passenger.type === "ADULT" && age < 12) {
      issues.push({ index, field: "dob", message: "Adult fares are for ages 12 and over" });
    }

    // Most countries require six months of passport validity beyond arrival,
    // so an expiry inside that window is worth stopping before payment.
    const sixMonthsAfter = new Date(`${departDate}T00:00:00Z`);
    sixMonthsAfter.setUTCMonth(sixMonthsAfter.getUTCMonth() + 6);
    if (new Date(`${passenger.passportExpiry}T00:00:00Z`) < sixMonthsAfter) {
      issues.push({
        index,
        field: "passportExpiry",
        message: "Most countries require six months of passport validity after arrival",
      });
    }
  });

  const infants = passengers.filter((p) => p.type === "INFANT").length;
  const adults = passengers.filter((p) => p.type === "ADULT").length;
  if (infants > adults) {
    issues.push({
      index: 0,
      field: "type",
      // An infant travels on an adult's lap, so each one needs an adult.
      message: "Each infant must travel with an accompanying adult",
    });
  }

  return issues;
}
