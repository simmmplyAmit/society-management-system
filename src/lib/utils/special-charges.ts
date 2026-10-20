// Pure helpers for "other charges". Shared by the server (billing) and the form (live preview).
import { toIdx } from "@/lib/utils/maintenance";

export type ChargeBasis = "FIXED" | "PER_SQFT";
export type ChargeSchedule = "ONE_TIME" | "RECURRING";
export type ChargeFrequency = "MONTHLY" | "QUARTERLY" | "HALF_YEARLY" | "YEARLY";

export const FREQUENCY_MONTHS: Record<ChargeFrequency, number> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  HALF_YEARLY: 6,
  YEARLY: 12,
};

export const FREQUENCY_LABEL: Record<ChargeFrequency, string> = {
  MONTHLY: "Every month",
  QUARTERLY: "Every 3 months",
  HALF_YEARLY: "Every 6 months",
  YEARLY: "Every year",
};

/** "2 bhk", "2-BHK" and "2BHK" are the same configuration. */
export function normalizeConfig(value: string | null | undefined): string {
  return (value ?? "").toUpperCase().replace(/[\s\-_.]/g, "");
}

export interface FlatAttrs {
  configuration: string | null;
  areaSqFt: number | null;
}

export interface ChargeRules {
  basis: ChargeBasis;
  rate: number;
  /** Normalized configurations. Empty means every configuration. */
  configurations: string[];
  minArea?: number | null;
  maxArea?: number | null;
}

/** Does the flat fall in the charge's target group? Area limits exclude flats with no area on record. */
export function flatMatches(flat: FlatAttrs, rules: ChargeRules): boolean {
  if (rules.configurations.length > 0) {
    if (!flat.configuration || !rules.configurations.includes(normalizeConfig(flat.configuration))) return false;
  }
  const hasMin = rules.minArea != null;
  const hasMax = rules.maxArea != null;
  if (hasMin || hasMax) {
    if (flat.areaSqFt == null) return false;
    if (hasMin && flat.areaSqFt < (rules.minArea as number)) return false;
    if (hasMax && flat.areaSqFt > (rules.maxArea as number)) return false;
  }
  return true;
}

/** What this flat is billed per period, or null if it can't be worked out (per-sq-ft with no area). */
export function chargeAmountFor(flat: FlatAttrs, rules: ChargeRules): number | null {
  if (rules.basis === "FIXED") return Math.round(rules.rate * 100) / 100;
  if (flat.areaSqFt == null || flat.areaSqFt <= 0) return null;
  return Math.round(rules.rate * flat.areaSqFt * 100) / 100;
}

export interface Preview {
  matched: number; // flats in the target group
  billable: number; // matched flats that get a bill
  missingArea: number; // matched flats that can't be billed per sq ft
  perPeriod: number; // total billed each period
}

export function previewCharge(flats: FlatAttrs[], rules: ChargeRules): Preview {
  let matched = 0, billable = 0, missingArea = 0, perPeriodPaise = 0;
  for (const f of flats) {
    if (!flatMatches(f, rules)) continue;
    matched += 1;
    const amount = chargeAmountFor(f, rules);
    if (amount == null) missingArea += 1;
    else {
      billable += 1;
      perPeriodPaise += Math.round(amount * 100);
    }
  }
  return { matched, billable, missingArea, perPeriod: perPeriodPaise / 100 };
}

export interface Schedule {
  schedule: ChargeSchedule;
  frequency: ChargeFrequency | null;
  startMonth: number;
  startYear: number;
  endMonth: number | null;
  endYear: number | null;
}

export const MAX_PERIODS = 60;

const fromIdx = (idx: number) => ({ year: Math.floor((idx - 1) / 12), month: ((idx - 1) % 12) + 1 });

/**
 * Billing months that have arrived (up to and including `upTo`). A one-time charge has a single
 * billing month; a recurring one steps by its frequency from the start to the end, inclusive.
 */
export function dueMonths(
  s: Schedule,
  upTo: { month: number; year: number }
): { month: number; year: number }[] {
  const start = toIdx(s.startMonth, s.startYear);
  const limit = toIdx(upTo.month, upTo.year);
  if (s.schedule === "ONE_TIME") return start <= limit ? [fromIdx(start)] : [];

  const step = FREQUENCY_MONTHS[s.frequency ?? "MONTHLY"];
  const end = s.endMonth != null && s.endYear != null ? toIdx(s.endMonth, s.endYear) : start; // end is required; be safe
  const out: { month: number; year: number }[] = [];
  for (let idx = start; idx <= Math.min(end, limit) && out.length < MAX_PERIODS; idx += step) out.push(fromIdx(idx));
  return out;
}

/** Number of billings in the whole schedule, for the form summary. */
export function totalPeriods(s: Schedule): number {
  if (s.schedule === "ONE_TIME") return 1;
  const step = FREQUENCY_MONTHS[s.frequency ?? "MONTHLY"];
  if (s.endMonth == null || s.endYear == null) return 0;
  const span = toIdx(s.endMonth, s.endYear) - toIdx(s.startMonth, s.startYear);
  return span < 0 ? 0 : Math.floor(span / step) + 1;
}

export function ruleSummary(rules: ChargeRules): string {
  const parts: string[] = [];
  parts.push(rules.configurations.length ? `Config: ${rules.configurations.join(", ")}` : "All configurations");
  if (rules.minArea != null && rules.maxArea != null) parts.push(`${rules.minArea}–${rules.maxArea} sq ft`);
  else if (rules.minArea != null) parts.push(`≥ ${rules.minArea} sq ft`);
  else if (rules.maxArea != null) parts.push(`≤ ${rules.maxArea} sq ft`);
  return parts.join(" · ");
}
