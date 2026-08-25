import type { AppLocale, CurrencyCode } from "./config";

/**
 * تنسيق محلي للأرقام والتواريخ والعملات — القسم 9.
 * الأرقام العربية الهندية اختيارية، والافتراضي أرقام لاتينية
 * لأنها الأوضح في سياق الأسعار والمطارات.
 */

const INTL_LOCALE: Record<AppLocale, string> = {
  ar: "ar-EG",
  en: "en-GB",
};

export function formatMoney(
  amount: number,
  currency: CurrencyCode,
  locale: AppLocale,
  options: { hindiDigits?: boolean } = {},
): string {
  const base = options.hindiDigits ? "ar-EG-u-nu-arab" : `${INTL_LOCALE[locale]}-u-nu-latn`;
  return new Intl.NumberFormat(base, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(
  date: Date,
  locale: AppLocale,
  style: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
): string {
  return new Intl.DateTimeFormat(`${INTL_LOCALE[locale]}-u-nu-latn`, style).format(date);
}

/** مدة الرحلة بصيغة "3 س 45 د" / "3h 45m". */
export function formatDuration(minutes: number, locale: AppLocale): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const unitH = locale === "ar" ? "س" : "h";
  const unitM = locale === "ar" ? "د" : "m";
  if (h === 0) return `${m}${unitM}`;
  if (m === 0) return `${h}${unitH}`;
  return `${h}${unitH} ${m}${unitM}`;
}
