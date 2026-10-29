// next-intl request configuration (used without locale prefixes in URLs).
import { getRequestConfig } from "next-intl/server";
import { intlLocale } from "./config";
import { resolveLocale } from "./locale";
import { getMessages } from "./messages";

export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  return { locale: intlLocale(locale), messages: getMessages(locale), timeZone: "Asia/Kolkata" };
});
