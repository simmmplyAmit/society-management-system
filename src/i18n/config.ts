// Pure: the languages the app speaks. English is the default and the fallback for any missing text.
export const LOCALES = ["en", "hi", "mr"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";
/** Remembers the choice in the browser, including before sign-in. */
export const LOCALE_COOKIE = "locale";

/** Each language's name in its own script, as shown in the language switcher. */
export const LOCALE_NAMES: Record<Locale, string> = { en: "English", hi: "हिन्दी", mr: "मराठी" };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** The app language behind any tag, e.g. "mr-IN-u-nu-latn" → "mr". */
export function baseLocale(locale: string | null | undefined): Locale {
  const base = (locale ?? "").split("-")[0];
  return isLocale(base) ? base : DEFAULT_LOCALE;
}

/**
 * BCP 47 tag used for formatting (dates, month names, counts inside messages). Marathi defaults to
 * Devanagari digits; Latin digits are kept so every number reads the same as amounts and UPI references.
 */
export function dateTag(locale: string | null | undefined): string {
  const base = baseLocale(locale);
  return base === "hi" ? "hi-IN" : base === "mr" ? "mr-IN-u-nu-latn" : "en-IN";
}

/** Locale handed to next-intl: the language, with Latin digits for Marathi. */
export function intlLocale(locale: Locale): string {
  return locale === "mr" ? dateTag(locale) : locale;
}
