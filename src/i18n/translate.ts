// Translations outside React, e.g. emails written in the recipient's language.
import { createTranslator } from "next-intl";
import { DEFAULT_LOCALE, intlLocale, isLocale, type Locale } from "./config";
import { getMessages } from "./messages";

export function localeOf(value: string | null | undefined): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export function translator(locale: string | null | undefined) {
  const l = localeOf(locale);
  return createTranslator({ locale: intlLocale(l), messages: getMessages(l) });
}
