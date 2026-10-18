/** Most floors or flats a single "add range" submit may create. */
export const MAX_RANGE = 100;

export type RangeResult<T> = { values: T[]; error?: undefined } | { values?: undefined; error: string };

/** Expands floor numbers from..to (inclusive). */
export function expandFloorRange(from: number, to: number): RangeResult<number> {
  if (to < from) return { error: "'To' floor must be the same as or higher than the first floor" };
  if (to - from + 1 > MAX_RANGE) return { error: `You can add at most ${MAX_RANGE} floors at once` };
  return { values: Array.from({ length: to - from + 1 }, (_, i) => from + i) };
}

/**
 * Expands flat numbers from..to (inclusive). `from` may carry a prefix and zero-padding:
 * ("A-101", "105") -> A-101 … A-105, ("001", "003") -> 001, 002, 003.
 * `to` is the last number; the same prefix may be repeated ("A-105").
 */
export function expandFlatRange(from: string, to: string): RangeResult<string> {
  const start = from.trim();
  const end = to.trim();

  const startMatch = /^(.*?)(\d+)$/.exec(start);
  if (!startMatch) return { error: "To add a range, the first flat number must end in digits (e.g. 101 or A-101)" };
  const [, prefix, startDigits] = startMatch;

  const endDigits = end.startsWith(prefix) ? end.slice(prefix.length) : end;
  if (!/^\d+$/.test(endDigits)) {
    return { error: `'To' must be a number (e.g. ${prefix}${Number(startDigits) + 4})` };
  }

  const first = Number(startDigits);
  const last = Number(endDigits);
  if (last < first) return { error: "'To' flat must be the same as or higher than the first flat" };
  if (last - first + 1 > MAX_RANGE) return { error: `You can add at most ${MAX_RANGE} flats at once` };

  const width = startDigits.startsWith("0") ? startDigits.length : 0;
  return {
    values: Array.from({ length: last - first + 1 }, (_, i) =>
      `${prefix}${String(first + i).padStart(width, "0")}`
    ),
  };
}

/** "Added 5 floors" / "Added 3 floors (2 already existed)" */
export function rangeSummary(noun: string, created: number, skipped: number): string {
  const label = created === 1 ? noun : `${noun}s`;
  return skipped > 0 ? `Added ${created} ${label} (${skipped} already existed)` : `Added ${created} ${label}`;
}
