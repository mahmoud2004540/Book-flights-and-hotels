import type { BookingStatus } from "@prisma/client";

/** How a booking is grouped in the dashboard — section 4.6. */
export type BookingBucket = "upcoming" | "past" | "cancelled";

export type BucketInput = {
  status: BookingStatus;
  departureAt: Date | null;
  now: Date;
};

/**
 * A cancelled or failed booking is always "cancelled" regardless of its dates:
 * a trip you are not taking does not belong under "upcoming", however far off
 * the departure was.
 */
export function bucketOf(input: BucketInput): BookingBucket {
  if (
    input.status === "CANCELLED" ||
    input.status === "REFUNDED" ||
    input.status === "FAILED"
  ) {
    return "cancelled";
  }

  // No departure recorded yet — a booking still being paid for — is upcoming,
  // because that is where the traveller will look for it.
  if (input.departureAt === null) return "upcoming";

  return input.departureAt.getTime() >= input.now.getTime() ? "upcoming" : "past";
}

export const BUCKET_LABELS: Record<BookingBucket, string> = {
  upcoming: "Upcoming",
  past: "Past",
  cancelled: "Cancelled",
};

export const STATUS_TONE: Record<BookingStatus, "neutral" | "brand" | "accent" | "critical"> = {
  PENDING: "brand",
  CONFIRMED: "accent",
  CANCELLED: "neutral",
  REFUNDED: "neutral",
  FAILED: "critical",
};
