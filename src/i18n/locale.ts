// Server-only: which language the current request should use.
// 1. the language cookie (set by the switcher, works before sign-in)
// 2. the signed-in user's saved choice (from the session, so a new phone starts in their language)
// 3. English
// Outside a request (tests, cron, scripts) it is always English.
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "./config";

export async function resolveLocale(): Promise<Locale> {
  try {
    const fromCookie = (await cookies()).get(LOCALE_COOKIE)?.value;
    if (isLocale(fromCookie)) return fromCookie;
  } catch {
    return DEFAULT_LOCALE;
  }
  try {
    const { auth } = await import("@/lib/auth");
    const locale = (await auth())?.user?.locale;
    if (isLocale(locale)) return locale;
  } catch {
    // no session available
  }
  return DEFAULT_LOCALE;
}
