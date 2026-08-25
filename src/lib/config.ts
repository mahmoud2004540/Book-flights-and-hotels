/**
 * إعدادات المنتج — المكان الوحيد الذي تُغيَّر منه هوية المشروع وأرقامه.
 * أي قيمة هنا يجب ألا تتكرر في أي ملف آخر.
 */

export const BRAND = {
  /** اسم المشروع. تغييره هنا يغيّره في كل الواجهة والإيميلات والتذاكر. */
  nameAr: "رِحلتي",
  nameEn: "Rehlaty",
  domain: "rehlaty.com",
} as const;

/** العملات المدعومة — القسم 1 من البريف. */
export const CURRENCIES = ["EGP", "USD", "SAR", "AED", "EUR"] as const;
export type CurrencyCode = (typeof CURRENCIES)[number];
export const DEFAULT_CURRENCY: CurrencyCode = "EGP";

/** اللغات المدعومة. العربية افتراضية — القسم 9. */
export const LOCALES = ["ar", "en"] as const;
export type AppLocale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: AppLocale = "ar";

export const LOCALE_DIRECTION: Record<AppLocale, "rtl" | "ltr"> = {
  ar: "rtl",
  en: "ltr",
};

/**
 * ترتيب المزوّدين. الأقل رقمًا = الأعلى أولوية عند تساوي السعر.
 * التفعيل الفعلي يقرأ من جدول suppliers، وهذه القيم بذرة الإعداد الأولى.
 */
export const SUPPLIER_PRIORITY = {
  amadeus: 10,
  travelpayouts: 20,
  duffel: 30,
  bookingcom: 40,
} as const;
export type SupplierId = keyof typeof SUPPLIER_PRIORITY;

/** مهلة إتمام الحجز بالدقائق — القسم 4.5. */
export const BOOKING_SESSION_MINUTES = 15;

/** حدود الطلبات — القسم 7. */
export const RATE_LIMITS = {
  searchPerUserPerMinute: 30,
  searchPerIpPerMinute: 100,
} as const;

/** مهل التعامل مع المزوّدين — القسم 3.3. */
export const SUPPLIER_TIMEOUTS = {
  /** مهلة الطلب الواحد لمزوّد واحد. */
  perRequestMs: 8_000,
  /** المهلة الكلية لطلب بحث كامل. */
  totalSearchMs: 15_000,
  retryAttempts: 3,
  circuitBreakerFailures: 5,
  circuitBreakerCooldownMs: 60_000,
} as const;

/** صلاحية كاش نتائج البحث — القسم 7. */
export const CACHE_TTL_SECONDS = {
  flightSearch: 300,
  hotelSearch: 600,
  places: 86_400,
} as const;
