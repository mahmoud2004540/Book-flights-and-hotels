/**
 * Booking shapes and prices shared by the server and the browser.
 *
 * Kept free of any server import on purpose: the checkout components need
 * these values, and importing them from the draft module would pull Prisma and
 * the Postgres driver into the client bundle.
 */

export type Passenger = {
  firstName: string;
  lastName: string;
  dob: string;
  nationality: string;
  passportNumber: string;
  passportExpiry: string;
  type: "ADULT" | "CHILD" | "INFANT";
};

export type Extras = {
  extraBags: number;
  seatSelection: boolean;
  travelInsurance: boolean;
};

/** Per traveller, the way airlines charge them. */
export const EXTRA_PRICES = { bag: 35, seat: 15, insurance: 24 } as const;

export function extrasTotal(extras: Extras, passengers: number): number {
  const people = Math.max(passengers, 1);
  return (
    extras.extraBags * EXTRA_PRICES.bag * people +
    (extras.seatSelection ? EXTRA_PRICES.seat * people : 0) +
    (extras.travelInsurance ? EXTRA_PRICES.insurance * people : 0)
  );
}
