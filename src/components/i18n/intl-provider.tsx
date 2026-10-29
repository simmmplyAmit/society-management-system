import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { baseLocale } from "@/i18n/config";

/**
 * Translations for the signed-in app and the sign-in pages. The root layout and the public
 * website stay outside it, so those pages remain static and in English.
 */
export async function IntlProvider({ children, className }: { children: React.ReactNode; className?: string }) {
  const locale = await getLocale();
  return (
    <NextIntlClientProvider>
      <div lang={baseLocale(locale)} className={className}>
        {children}
      </div>
    </NextIntlClientProvider>
  );
}
