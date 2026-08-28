/** Locale-aware formatting for numbers, dates and currency — section 9. */

const INTL_LOCALE = "en-GB";

const AMOUNT = new Intl.NumberFormat(INTL_LOCALE, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Money as "USD 1,234.50".
 *
 * The code is written out rather than using Intl's currency style, which
 * renders USD as "US$" in en-GB and reads as a different currency to someone
 * comparing prices. Always two decimals: a total shown as "397.1" looks like a
 * figure that has been rounded, and nothing on a receipt may look rounded.
 *
 * Amounts arrive as strings from Prisma Decimal columns and are accepted as
 * such, so no caller has to remember to convert.
 */
export function formatAmount(amount: number | string, currency: string): string {
  return `${currency} ${AMOUNT.format(Number(amount))}`;
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
