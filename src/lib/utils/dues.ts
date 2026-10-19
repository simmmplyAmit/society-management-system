import { MONTHS } from "@/lib/utils/month";

interface DueLike {
  amount: string | number;
  month: number;
  year: number;
}

export function selectedTotal(dues: DueLike[]): number {
  return dues.reduce((sum, d) => sum + Number(d.amount), 0);
}

/** Oldest first. */
function byPeriod(a: DueLike, b: DueLike) {
  return a.year - b.year || a.month - b.month;
}

const NOTE_MAX = 50; // UPI transaction notes are limited to ~50 characters

/**
 * Short UPI note that tells the treasurer which months a payment covers,
 * e.g. "Maintenance Sep 2026, Oct 2026" or "Maintenance 5 months".
 */
export function duesNote(dues: DueLike[]): string {
  if (dues.length === 0) return "Maintenance";
  const months = [...dues].sort(byPeriod).map((d) => `${MONTHS[d.month - 1].slice(0, 3)} ${d.year}`);
  const listed = `Maintenance ${[...new Set(months)].join(", ")}`;
  if (listed.length <= NOTE_MAX) return listed;
  return `Maintenance ${new Set(months).size} months`;
}
