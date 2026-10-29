import { baseLocale } from "@/i18n/config";

// Words used in flat labels. Wing and flat names themselves are whatever the society entered.
const WORDS = {
  en: { wing: "Wing", floor: "Floor", f: "F", flat: "Flat" },
  hi: { wing: "विंग", floor: "मंज़िल", f: "मंज़िल ", flat: "फ़्लैट" },
  mr: { wing: "विंग", floor: "मजला", f: "मजला ", flat: "फ्लॅट" },
} as const;
const words = (locale?: string | null) => WORDS[baseLocale(locale)];

interface FlatLike {
  number: string;
  floor: { number: number; wing: { name: string } };
}

/** Format a flat's display label depending on whether the society uses wings. */
export function flatLabel(flat: FlatLike, hasWings: boolean, locale?: string | null): string {
  const w = words(locale);
  if (hasWings) {
    return `${w.wing} ${flat.floor.wing.name} · ${w.f}${flat.floor.number} · ${flat.number}`;
  }
  return `${w.floor} ${flat.floor.number} · ${w.flat} ${flat.number}`;
}

/** Longer form used in dropdown options. */
export function flatOptionLabel(flat: FlatLike, hasWings: boolean, locale?: string | null): string {
  const w = words(locale);
  if (hasWings) {
    return `${w.wing} ${flat.floor.wing.name} · ${w.floor} ${flat.floor.number} · ${w.flat} ${flat.number}`;
  }
  return `${w.floor} ${flat.floor.number} · ${w.flat} ${flat.number}`;
}
