import { defineRouting } from "next-intl/routing";
import { DEFAULT_LOCALE, LOCALES } from "@/lib/config";

export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  // البادئة تظهر دائمًا (/ar, /en) — يجعل الروابط صريحة وقابلة للمشاركة
  // ويتجنّب اختلاف المحتوى على نفس المسار، وهو ما يربك الفهرسة.
  localePrefix: "always",
});
