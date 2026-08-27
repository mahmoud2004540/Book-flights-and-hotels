/**
 * Product configuration — the single place where the project's identity and
 * numbers are set. No value here should be repeated in any other file.
 */

export const BRAND = {
  /** Project name. Changing it here changes it across the UI, emails and tickets. */
  name: "Rehlaty",
  domain: "rehlaty.com",
} as const;

/** Supported currencies — section 1 of the brief. */
export const CURRENCIES = ["EGP", "USD", "SAR", "AED", "EUR"] as const;
export type CurrencyCode = (typeof CURRENCIES)[number];
export const DEFAULT_CURRENCY: CurrencyCode = "USD";

/**
 * Supported languages. English only for now.
 * Strings still live in messages/ rather than in components, so adding a
 * language later is a config change rather than a rewrite.
 */
export const LOCALES = ["en"] as const;
export type AppLocale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: AppLocale = "en";

/**
 * Supplier order. Lower number wins when prices tie.
 * Live activation reads the suppliers table; these are the seed values.
 */
export const SUPPLIER_PRIORITY = {
  amadeus: 10,
  travelpayouts: 20,
  duffel: 30,
  bookingcom: 40,
} as const;
export type SupplierId = keyof typeof SUPPLIER_PRIORITY;

/** Minutes allowed to complete a booking — section 4.5. */
export const BOOKING_SESSION_MINUTES = 15;

/** Request limits — section 7. */
export const RATE_LIMITS = {
  searchPerUserPerMinute: 30,
  searchPerIpPerMinute: 100,
} as const;

/** Supplier call budgets — section 3.3. */
export const SUPPLIER_TIMEOUTS = {
  /** Budget for a single request to a single supplier. */
  perRequestMs: 8_000,
  /** Budget for a whole search across all suppliers. */
  totalSearchMs: 15_000,
  retryAttempts: 3,
  circuitBreakerFailures: 5,
  circuitBreakerCooldownMs: 60_000,
} as const;

/** Search result cache lifetimes — section 7. */
export const CACHE_TTL_SECONDS = {
  flightSearch: 300,
  hotelSearch: 600,
  places: 86_400,
} as const;
