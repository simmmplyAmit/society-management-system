import { describe, it, expect } from "vitest";
import { greetingFor, NOTICE_EMOJI, POST_EMOJI, COMPLAINT_EMOJI, STATUS_EMOJI, DOCUMENT_EMOJI } from "@/lib/utils/emoji";
import { NOTICE_LABELS, POST_LABELS, COMPLAINT_LABELS, STATUS_LABELS } from "@/lib/utils/community";
import { CATEGORY_LABELS } from "@/lib/utils/documents";

describe("greetingFor", () => {
  // IST is UTC+5:30
  const at = (utc: string) => greetingFor(new Date(utc));
  it("uses Indian time whatever the server's timezone is", () => {
    expect(at("2026-10-29T03:00:00Z").text).toBe("Good morning"); // 08:30 IST
    expect(at("2026-10-29T08:00:00Z").text).toBe("Good afternoon"); // 13:30 IST
    expect(at("2026-10-29T13:00:00Z").text).toBe("Good evening"); // 18:30 IST
    expect(at("2026-10-29T17:00:00Z").text).toBe("Hello"); // 22:30 IST
    expect(at("2026-10-28T20:00:00Z").text).toBe("Hello"); // 01:30 IST
  });
  it("always returns an emoji", () => {
    for (const h of [0, 4, 6, 12, 16, 19, 23]) expect(at(`2026-10-29T${String(h).padStart(2, "0")}:00:00Z`).emoji).toMatch(/\S/);
  });
});

describe("emoji maps cover every category", () => {
  const keys = (o: object) => Object.keys(o).sort();
  it("matches the label maps", () => {
    expect(keys(NOTICE_EMOJI)).toEqual(keys(NOTICE_LABELS));
    expect(keys(POST_EMOJI)).toEqual(keys(POST_LABELS));
    expect(keys(COMPLAINT_EMOJI)).toEqual(keys(COMPLAINT_LABELS));
    expect(keys(STATUS_EMOJI)).toEqual(keys(STATUS_LABELS));
    expect(keys(DOCUMENT_EMOJI)).toEqual(keys(CATEGORY_LABELS));
  });
});
