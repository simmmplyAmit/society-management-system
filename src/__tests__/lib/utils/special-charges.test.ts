import { describe, it, expect } from "vitest";
import {
  normalizeConfig, flatMatches, chargeAmountFor, previewCharge, dueMonths, totalPeriods, ruleSummary,
  type ChargeRules, type Schedule,
} from "@/lib/utils/special-charges";

const flat = (configuration: string | null, areaSqFt: number | null) => ({ configuration, areaSqFt });
const rules = (over: Partial<ChargeRules> = {}): ChargeRules => ({ basis: "FIXED", rate: 500, configurations: [], ...over });

describe("normalizeConfig", () => {
  it("treats spacing, case and dashes as the same configuration", () => {
    expect(normalizeConfig("2 bhk")).toBe("2BHK");
    expect(normalizeConfig(" 2-BHK ")).toBe("2BHK");
    expect(normalizeConfig(null)).toBe("");
  });
});

describe("flatMatches", () => {
  it("matches everything with no filters", () => {
    expect(flatMatches(flat(null, null), rules())).toBe(true);
  });

  it("filters by configuration, ignoring formatting", () => {
    const r = rules({ configurations: ["2BHK", "3BHK"] });
    expect(flatMatches(flat("2 bhk", 900), r)).toBe(true);
    expect(flatMatches(flat("1BHK", 600), r)).toBe(false);
    expect(flatMatches(flat(null, 900), r)).toBe(false); // unknown configuration can't match
  });

  it("filters by area range inclusively, excluding flats with no area on record", () => {
    const r = rules({ minArea: 800, maxArea: 1000 });
    expect(flatMatches(flat("2BHK", 800), r)).toBe(true);
    expect(flatMatches(flat("2BHK", 1000), r)).toBe(true);
    expect(flatMatches(flat("2BHK", 799.99), r)).toBe(false);
    expect(flatMatches(flat("2BHK", 1001), r)).toBe(false);
    expect(flatMatches(flat("2BHK", null), r)).toBe(false);
    expect(flatMatches(flat("2BHK", 5000), rules({ minArea: 800 }))).toBe(true);
    expect(flatMatches(flat("2BHK", 5000), rules({ maxArea: 800 }))).toBe(false);
  });

  it("combines configuration and area", () => {
    const r = rules({ configurations: ["2BHK"], minArea: 900 });
    expect(flatMatches(flat("2BHK", 950), r)).toBe(true);
    expect(flatMatches(flat("2BHK", 850), r)).toBe(false);
    expect(flatMatches(flat("3BHK", 950), r)).toBe(false);
  });
});

describe("chargeAmountFor", () => {
  it("charges a fixed amount per flat", () => {
    expect(chargeAmountFor(flat(null, null), rules({ rate: 1234.5 }))).toBe(1234.5);
  });
  it("charges per sq ft, rounded to paise, and refuses when area is unknown", () => {
    const r = rules({ basis: "PER_SQFT", rate: 2.5 });
    expect(chargeAmountFor(flat("2BHK", 925), r)).toBe(2312.5);
    expect(chargeAmountFor(flat("2BHK", 100.333), rules({ basis: "PER_SQFT", rate: 3 }))).toBe(301);
    expect(chargeAmountFor(flat("2BHK", null), r)).toBeNull();
    expect(chargeAmountFor(flat("2BHK", 0), r)).toBeNull();
  });
});

describe("previewCharge", () => {
  it("counts matched, billable and un-billable flats and totals one billing", () => {
    const flats = [flat("2BHK", 900), flat("2BHK", null), flat("1BHK", 600), flat("2BHK", 1000)];
    const p = previewCharge(flats, rules({ basis: "PER_SQFT", rate: 2, configurations: ["2BHK"] }));
    expect(p).toEqual({ matched: 3, billable: 2, missingArea: 1, perPeriod: 3800 });
  });
});

describe("dueMonths", () => {
  const rec = (over: Partial<Schedule> = {}): Schedule => ({
    schedule: "RECURRING", frequency: "MONTHLY", startMonth: 1, startYear: 2026, endMonth: 12, endYear: 2026, ...over,
  });

  it("a one-time charge bills its month once it has arrived, never before", () => {
    const one: Schedule = { schedule: "ONE_TIME", frequency: null, startMonth: 11, startYear: 2026, endMonth: null, endYear: null };
    expect(dueMonths(one, { month: 10, year: 2026 })).toEqual([]);
    expect(dueMonths(one, { month: 11, year: 2026 })).toEqual([{ month: 11, year: 2026 }]);
    expect(dueMonths(one, { month: 3, year: 2027 })).toEqual([{ month: 11, year: 2026 }]);
  });

  it("monthly recurring covers start to end, limited to months that have arrived", () => {
    expect(dueMonths(rec(), { month: 3, year: 2026 }).map((d) => d.month)).toEqual([1, 2, 3]);
    expect(dueMonths(rec(), { month: 6, year: 2030 })).toHaveLength(12);
  });

  it("steps by frequency across a year boundary and stops at the end month", () => {
    const q = rec({ frequency: "QUARTERLY", startMonth: 11, startYear: 2026, endMonth: 5, endYear: 2027 });
    expect(dueMonths(q, { month: 12, year: 2027 })).toEqual([
      { month: 11, year: 2026 }, { month: 2, year: 2027 }, { month: 5, year: 2027 },
    ]);
    const y = rec({ frequency: "YEARLY", startYear: 2026, endYear: 2028 });
    expect(dueMonths(y, { month: 12, year: 2030 }).map((d) => d.year)).toEqual([2026, 2027, 2028]);
  });

  it("caps runaway schedules", () => {
    const long = rec({ endYear: 2100 });
    expect(dueMonths(long, { month: 12, year: 2100 })).toHaveLength(60);
  });

  it("counts the periods of a whole schedule", () => {
    expect(totalPeriods(rec())).toBe(12);
    expect(totalPeriods(rec({ frequency: "QUARTERLY" }))).toBe(4);
    expect(totalPeriods(rec({ endYear: 2025 }))).toBe(0);
    expect(totalPeriods({ schedule: "ONE_TIME", frequency: null, startMonth: 1, startYear: 2026, endMonth: null, endYear: null })).toBe(1);
  });
});

describe("ruleSummary", () => {
  it("describes the target group", () => {
    expect(ruleSummary(rules())).toBe("All configurations");
    expect(ruleSummary(rules({ configurations: ["2BHK"], minArea: 800, maxArea: 1000 }))).toBe("Config: 2BHK · 800–1000 sq ft");
    expect(ruleSummary(rules({ minArea: 800 }))).toBe("All configurations · ≥ 800 sq ft");
  });
});
