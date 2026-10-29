// Pure parsers for the formats people actually type into registers and Excel sheets in India.
// Dates are read day-first (15/04/2025), as Indian spreadsheets write them.

const MONTH_NAMES = "january february march april may june july august september october november december".split(" ");

/** "Apr", "april", "Sept" → 4 / 4 / 9. At least three letters, and a prefix of the month's name. */
function monthFromName(name: string): number | null {
  const n = name.toLowerCase().replace(/\.$/, "");
  if (n.length < 3) return null;
  const idx = MONTH_NAMES.findIndex((m) => m.startsWith(n));
  return idx === -1 ? null : idx + 1;
}

function fullYear(y: string): number {
  const n = Number(y);
  return y.length === 2 ? 2000 + n : n;
}

function validDay(d: number, m: number, y: number): boolean {
  if (m < 1 || m > 12 || d < 1) return false;
  return d <= new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Rupee amount → number with at most 2 decimals. Accepts "₹1,200.50", "Rs. 1200", "1200/-". Null if blank or invalid. */
export function parseAmount(raw: string): number | null {
  const s = raw
    .replace(/₹|rs\.?|inr|\/-/gi, "")
    .replace(/[,\s]/g, "");
  if (s === "" || s === "-") return null;
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  return Math.round(Number(s) * 100) / 100;
}

/** A calendar date at UTC midnight. Accepts 15/04/2025, 15-04-25, 2025-04-15, 15 Apr 2025, 15-Apr-2025, Apr 15, 2025. */
export function parseDate(raw: string): Date | null {
  const s = raw.trim().replace(/,/g, " ").replace(/\s+/g, " ");
  let d: number, m: number | null, y: number;

  let r = /^(\d{1,2})[/\-. ](\d{1,2})[/\-. ](\d{2}|\d{4})$/.exec(s);
  if (r) {
    [d, m, y] = [Number(r[1]), Number(r[2]), fullYear(r[3])];
  } else if ((r = /^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})(?:[ T].*)?$/.exec(s))) {
    [y, m, d] = [Number(r[1]), Number(r[2]), Number(r[3])];
  } else if ((r = /^(\d{1,2})[\s\-/.]*([a-z]+)\.?[\s\-/.']*(\d{2}|\d{4})$/i.exec(s))) {
    [d, m, y] = [Number(r[1]), monthFromName(r[2]), fullYear(r[3])];
  } else if ((r = /^([a-z]+)\.? (\d{1,2}) (\d{4})$/i.exec(s))) {
    [m, d, y] = [monthFromName(r[1]), Number(r[2]), Number(r[3])];
  } else {
    return null;
  }
  if (m === null || !validDay(d, m, y)) return null;
  return new Date(Date.UTC(y, m - 1, d));
}

/** A billing month. Accepts 04/2025, 4-25, 2025-04, Apr 2025, April-2025, Apr'25, or a full date (its month is used). */
export function parseMonth(raw: string): { month: number; year: number } | null {
  const s = raw.trim();
  let m: number | null, y: number;
  let r = /^(\d{1,2})[/\-. ](\d{2}|\d{4})$/.exec(s);
  if (r) {
    [m, y] = [Number(r[1]), fullYear(r[2])];
  } else if ((r = /^(\d{4})[/\-.](\d{1,2})$/.exec(s))) {
    [y, m] = [Number(r[1]), Number(r[2])];
  } else if ((r = /^([a-z]+)\.?[\s\-/.,']*(\d{2}|\d{4})$/i.exec(s))) {
    [m, y] = [monthFromName(r[1]), fullYear(r[2])];
  } else {
    const date = parseDate(s);
    return date ? { month: date.getUTCMonth() + 1, year: date.getUTCFullYear() } : null;
  }
  if (m === null || m < 1 || m > 12 || y < 2000 || y > 2100) return null;
  return { month: m, year: y };
}

/** Floor number: 0 for G / Ground / GF, -1 for basement, "3", "3rd", "Floor 3". */
export function parseFloor(raw: string): number | null {
  const s = raw.trim().toLowerCase();
  if (/^(g|gf|ground|ground floor|stilt)$/.test(s)) return 0;
  if (/^(b|basement|lower ground|lg)$/.test(s)) return -1;
  const r = /^(?:floor\s*)?(-?\d{1,3})(?:st|nd|rd|th)?(?:\s*floor)?$/.exec(s);
  if (!r) return null;
  const n = Number(r[1]);
  return n >= -5 && n <= 200 ? n : null;
}

/** Guesses the floor from a flat number: 101 → 1, 1203 → 12, G01 / G-2 → 0. Null when it can't tell. */
export function floorFromFlatNumber(flat: string): number | null {
  const s = flat.trim();
  if (/^g[-\s]?\d{1,2}$/i.test(s)) return 0;
  const r = /(\d+)$/.exec(s);
  if (!r) return null;
  const n = Number(r[1]);
  return n >= 100 ? Math.floor(n / 100) : null;
}

/** yes / y / true / 1 / ✓ → true, blank / no → false, anything else → null. */
export function parseYesNo(raw: string): boolean | null {
  const s = raw.trim().toLowerCase();
  if (s === "") return false;
  if (["yes", "y", "true", "1", "✓", "primary"].includes(s)) return true;
  if (["no", "n", "false", "0"].includes(s)) return false;
  return null;
}
