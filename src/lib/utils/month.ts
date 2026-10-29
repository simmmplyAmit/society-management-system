import { baseLocale, dateTag } from "@/i18n/config";

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "October 2026"; in Hindi "अक्टूबर 2026", in Marathi "ऑक्टोबर 2026". */
export function monthLabel(month: number, year: number, locale?: string | null) {
  if (baseLocale(locale) === "en") return `${MONTHS[month - 1]} ${year}`;
  return new Intl.DateTimeFormat(dateTag(locale), { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, 1))
  );
}

export function currentMonthYear() {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

export function formatDate(date: Date | string | null, locale?: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString(dateTag(locale), {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatCurrency(amount: number | string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(amount));
}
