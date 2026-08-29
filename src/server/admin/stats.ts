import { BookingStatus, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * The numbers on the admin overview — section 7.
 *
 * Revenue is counted from succeeded payments minus refunds, not from booking
 * totals: a booking row records what was asked for, a payment records what
 * actually arrived, and only the second is money.
 */

export type Totals = {
  bookings: number;
  confirmed: number;
  cancelled: number;
  failed: number;
  users: number;
  newUsers: number;
};

export type Money = { gross: string; refunded: string; net: string; currency: string };

export type DayPoint = { day: string; bookings: number };

export type StatusSlice = { status: BookingStatus; count: number };

export type SupplierSlice = { supplierId: string; bookings: number };

/** Midnight UTC `days` ago — the window every figure below is measured over. */
function since(days: number): Date {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - days);
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

export async function totals(days: number): Promise<Totals> {
  const from = since(days);
  const [bookings, confirmed, cancelled, failed, users, newUsers] = await Promise.all([
    prisma.booking.count({ where: { createdAt: { gte: from } } }),
    prisma.booking.count({ where: { createdAt: { gte: from }, status: BookingStatus.CONFIRMED } }),
    prisma.booking.count({ where: { createdAt: { gte: from }, status: BookingStatus.CANCELLED } }),
    prisma.booking.count({ where: { createdAt: { gte: from }, status: BookingStatus.FAILED } }),
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: from } } }),
  ]);

  return { bookings, confirmed, cancelled, failed, users, newUsers };
}

/**
 * Gross taken, refunded, and what is left.
 *
 * Grouped by currency and reported only when the whole window is in one, rather
 * than adding EGP to USD and calling the sum revenue. A mixed window says so
 * instead of lying with a single number.
 */
export async function revenue(days: number): Promise<Money | null> {
  const from = since(days);

  const paid = await prisma.payment.groupBy({
    by: ["currency"],
    where: { createdAt: { gte: from }, status: PaymentStatus.SUCCEEDED },
    _sum: { amount: true },
  });
  if (paid.length !== 1) return null;

  const row = paid[0];
  if (!row) return null;

  const refunds = await prisma.refund.aggregate({
    where: { createdAt: { gte: from }, status: "SUCCEEDED", payment: { currency: row.currency } },
    _sum: { amount: true },
  });

  const gross = Number(row._sum.amount ?? 0);
  const refunded = Number(refunds._sum.amount ?? 0);

  return {
    gross: gross.toFixed(2),
    refunded: refunded.toFixed(2),
    net: (gross - refunded).toFixed(2),
    currency: row.currency,
  };
}

export async function byStatus(days: number): Promise<StatusSlice[]> {
  const grouped = await prisma.booking.groupBy({
    by: ["status"],
    where: { createdAt: { gte: since(days) } },
    _count: { _all: true },
  });

  return grouped
    .map((row) => ({ status: row.status, count: row._count._all }))
    .sort((a, b) => b.count - a.count);
}

export async function bySupplier(days: number): Promise<SupplierSlice[]> {
  const grouped = await prisma.booking.groupBy({
    by: ["supplierId"],
    where: { createdAt: { gte: since(days) } },
    _count: { _all: true },
  });

  return grouped
    .map((row) => ({ supplierId: row.supplierId, bookings: row._count._all }))
    .sort((a, b) => b.bookings - a.bookings);
}

/**
 * Bookings per day, with empty days included.
 *
 * Grouping in SQL would skip days that saw nothing, and a chart that silently
 * omits its zeros makes a quiet week look like a busy one.
 */
export async function daily(days: number): Promise<DayPoint[]> {
  const from = since(days);
  const rows = await prisma.booking.findMany({
    where: { createdAt: { gte: from } },
    select: { createdAt: true },
  });

  const counts = new Map<string, number>();
  for (let i = 0; i <= days; i++) {
    const day = new Date(from);
    day.setUTCDate(day.getUTCDate() + i);
    counts.set(day.toISOString().slice(0, 10), 0);
  }

  for (const row of rows) {
    const key = row.createdAt.toISOString().slice(0, 10);
    const current = counts.get(key);
    if (current !== undefined) counts.set(key, current + 1);
  }

  return [...counts.entries()].map(([day, bookings]) => ({ day, bookings }));
}
