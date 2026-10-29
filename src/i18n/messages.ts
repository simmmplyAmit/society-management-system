import en from "../../messages/en.json";
import hi from "../../messages/hi.json";
import mr from "../../messages/mr.json";
import type { Locale } from "./config";

export type Messages = typeof en;

// Missing keys in hi/mr fall back to English (see getMessages), so a new English string never
// breaks a screen before it is translated.
export const MESSAGES: Record<Locale, Messages> = { en, hi: hi as Messages, mr: mr as Messages };

type Tree = { [key: string]: string | Tree };

function merge(base: Tree, over: Tree): Tree {
  const out: Tree = { ...base };
  for (const [k, v] of Object.entries(over)) {
    out[k] = typeof v === "object" && typeof base[k] === "object" ? merge(base[k] as Tree, v) : v;
  }
  return out;
}

/** The locale's messages with English filled in for anything not translated yet. */
export function getMessages(locale: Locale): Messages {
  return locale === "en" ? en : (merge(en as Tree, MESSAGES[locale] as Tree) as Messages);
}
