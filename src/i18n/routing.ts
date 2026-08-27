import { defineRouting } from "next-intl/routing";
import { DEFAULT_LOCALE, LOCALES } from "@/lib/config";

export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  // With a single language, a locale prefix in the URL is noise.
  // Adding a second language later means changing this to "always".
  localePrefix: "never",
});
