import { describe, it, expect } from "vitest";
import { canTransition, cleanText, noticeIsLive, timeAgo, withinReopenWindow } from "@/lib/utils/community";

describe("canTransition", () => {
  it("lets the committee move a complaint forward", () => {
    expect(canTransition("OPEN", "IN_PROGRESS", "committee")).toBe(true);
    expect(canTransition("OPEN", "RESOLVED", "committee")).toBe(true);
    expect(canTransition("IN_PROGRESS", "RESOLVED", "committee")).toBe(true);
    expect(canTransition("RESOLVED", "IN_PROGRESS", "committee")).toBe(true); // more work needed
  });
  it("does not let the committee close or reopen on the resident's behalf", () => {
    expect(canTransition("RESOLVED", "CLOSED", "committee")).toBe(false);
    expect(canTransition("CLOSED", "OPEN", "committee")).toBe(false);
    expect(canTransition("OPEN", "CLOSED", "committee")).toBe(false);
  });
  it("lets the resident confirm a resolved complaint or reopen a resolved/closed one, nothing else", () => {
    expect(canTransition("RESOLVED", "CLOSED", "raiser")).toBe(true);
    expect(canTransition("RESOLVED", "OPEN", "raiser")).toBe(true);
    expect(canTransition("CLOSED", "OPEN", "raiser")).toBe(true);
    expect(canTransition("OPEN", "CLOSED", "raiser")).toBe(false);
    expect(canTransition("OPEN", "RESOLVED", "raiser")).toBe(false);
    expect(canTransition("IN_PROGRESS", "OPEN", "raiser")).toBe(false);
  });
  it("rejects a no-op", () => {
    expect(canTransition("OPEN", "OPEN", "committee")).toBe(false);
    expect(canTransition("CLOSED", "CLOSED", "raiser")).toBe(false);
  });
});

describe("withinReopenWindow", () => {
  const now = new Date("2026-10-30T00:00:00Z");
  it("allows 14 days", () => {
    expect(withinReopenWindow(new Date("2026-10-20T00:00:00Z"), now)).toBe(true);
    expect(withinReopenWindow(new Date("2026-10-10T00:00:00Z"), now)).toBe(false);
  });
  it("refuses when there is no date", () => expect(withinReopenWindow(null, now)).toBe(false));
});

describe("cleanText / noticeIsLive / timeAgo", () => {
  it("tidies text without changing meaning", () => {
    expect(cleanText("  a\r\nb\u0000\n\n\n\nc  ")).toBe("a\nb\n\nc");
  });
  it("hides deleted and expired notices", () => {
    const now = new Date("2026-10-30T00:00:00Z");
    expect(noticeIsLive({ expiresOn: null, deletedAt: null }, now)).toBe(true);
    expect(noticeIsLive({ expiresOn: new Date("2026-11-01"), deletedAt: null }, now)).toBe(true);
    expect(noticeIsLive({ expiresOn: new Date("2026-10-01"), deletedAt: null }, now)).toBe(false);
    expect(noticeIsLive({ expiresOn: null, deletedAt: new Date() }, now)).toBe(false);
  });
  it("formats relative times", () => {
    const now = new Date("2026-10-30T12:00:00Z");
    expect(timeAgo(new Date("2026-10-30T11:59:50Z"), now)).toBe("just now");
    expect(timeAgo(new Date("2026-10-30T11:30:00Z"), now)).toBe("30 min ago");
    expect(timeAgo(new Date("2026-10-30T09:00:00Z"), now)).toBe("3 h ago");
    expect(timeAgo(new Date("2026-10-28T12:00:00Z"), now)).toBe("2 d ago");
  });
});
