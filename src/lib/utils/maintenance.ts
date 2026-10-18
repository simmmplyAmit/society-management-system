// Pure helpers for maintenance periods (safe to import anywhere).

/** Convert month+year into a single integer for easy comparison */
export function toIdx(month: number, year: number) {
  return year * 12 + month;
}

/** True when (month, year) is strictly before the month containing `now`. */
export function isBeforeCurrentMonth(month: number, year: number, now: Date = new Date()) {
  return toIdx(month, year) < toIdx(now.getMonth() + 1, now.getFullYear());
}

/** Month/year immediately before the given one. */
export function previousMonth(month: number, year: number) {
  return month === 1 ? { month: 12, year: year - 1 } : { month: month - 1, year };
}

/** Check whether two charge periods overlap.
 *  null endMonth/endYear means "open-ended" (ongoing). */
export function periodsOverlap(
  aStart: number, aEnd: number | null, // monthIdx
  bStart: number, bEnd: number | null
) {
  // a ends before b starts → no overlap
  if (aEnd !== null && aEnd < bStart) return false;
  // b ends before a starts → no overlap
  if (bEnd !== null && bEnd < aStart) return false;
  return true;
}

