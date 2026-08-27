import type { CurrencyCode } from "./config";

/** Locale-aware formatting for numbers, dates and currency — section 9. */

const INTL_LOCALE = "en-GB";

export function formatMoney(amount: number, currency: CurrencyCode): string {
  return new Intl.NumberFormat(INTL_LOCALE, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(
  date: Date,
  style: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
): string {
  return new Intl.DateTimeFormat(INTL_LOCALE, style).format(date);
}

/** Flight duration as "3h 45m". */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
