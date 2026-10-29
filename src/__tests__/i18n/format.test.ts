import { describe, it, expect } from "vitest";
import { dateTag, isLocale } from "@/i18n/config";
import { formatDate, monthLabel } from "@/lib/utils/month";
import { dueTitle } from "@/lib/utils/dues";
import { flatLabel, flatOptionLabel } from "@/lib/utils/flat";
import { timeAgo } from "@/lib/utils/community";

const flat = { number: "102", floor: { number: 1, wing: { name: "A" } } };

describe("locale config", () => {
  it("accepts only the supported languages", () => {
    expect(isLocale("mr")).toBe(true);
    expect(isLocale("fr")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });

  it("keeps Latin digits for Marathi dates", () => {
    expect(dateTag("mr")).toBe("mr-IN-u-nu-latn");
    expect(dateTag(null)).toBe("en-IN");
  });
});

describe("language-aware formatting", () => {
  it("leaves English exactly as before", () => {
    expect(monthLabel(10, 2026)).toBe("October 2026");
    expect(monthLabel(10, 2026, "en")).toBe("October 2026");
    expect(flatLabel(flat, true)).toBe("Wing A · F1 · 102");
    expect(flatOptionLabel(flat, false)).toBe("Floor 1 · Flat 102");
    expect(timeAgo(new Date(0), new Date(30_000))).toBe("just now");
  });

  it("names months in Hindi and Marathi with Latin digits", () => {
    expect(monthLabel(10, 2026, "hi")).toBe("अक्टूबर 2026");
    expect(monthLabel(10, 2026, "mr")).toBe("ऑक्टोबर 2026");
    expect(formatDate(new Date(Date.UTC(2026, 9, 5, 6)), "mr")).toMatch(/^05 ऑक्टो/);
  });

  it("translates the words in flat labels but not the names", () => {
    expect(flatLabel(flat, true, "hi")).toBe("विंग A · मंज़िल 1 · 102");
    expect(flatOptionLabel(flat, false, "mr")).toBe("मजला 1 · फ्लॅट 102");
  });

  it("titles dues in the language, keeping a charge's own name", () => {
    expect(dueTitle({ label: "Maintenance", month: 9, year: 2026 }, "hi")).toBe("सितंबर 2026");
    expect(dueTitle({ label: "Sinking fund", month: 9, year: 2026 }, "mr")).toBe("Sinking fund · सप्टेंबर 2026");
  });

  it("says how long ago in the language", () => {
    const now = new Date(10 * 86_400_000);
    expect(timeAgo(new Date(now.getTime() - 10_000), now, "mr")).toBe("आत्ताच");
    expect(timeAgo(new Date(now.getTime() - 2 * 86_400_000), now, "hi")).toBe("2 दिन पहले");
  });
});
