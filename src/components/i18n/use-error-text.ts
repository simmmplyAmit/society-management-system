"use client";

import { useMessages, useTranslations } from "next-intl";
import en from "../../../messages/en.json";

/**
 * Server actions return English error messages. Known ones (listed under "errors" in
 * messages/en.json) are shown in the user's language; anything else is shown as sent.
 */
export function useErrorText() {
  const t = useTranslations("errors");
  useMessages(); // re-render when the language changes
  const english = en.errors as Record<string, string>;
  const byText = new Map(Object.entries(english).map(([key, text]) => [text, key]));
  return (message: string) => {
    const key = byText.get(message);
    return key ? t(key) : message;
  };
}
