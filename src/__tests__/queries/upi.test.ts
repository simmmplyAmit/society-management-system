import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { upiChangeRequest: { findFirst: vi.fn() } },
}));

import { prisma } from "@/lib/prisma";
import { isExpired, getPendingUpiRequestFor, UPI_REQUEST_TTL_MS } from "@/lib/queries/upi";

beforeEach(() => vi.clearAllMocks());

describe("isExpired", () => {
  it("lapses just after the TTL", () => {
    const now = new Date("2026-10-19T12:00:00Z");
    expect(isExpired(new Date(now.getTime() - UPI_REQUEST_TTL_MS), now)).toBe(false);
    expect(isExpired(new Date(now.getTime() - UPI_REQUEST_TTL_MS - 1), now)).toBe(true);
  });
});

describe("getPendingUpiRequestFor", () => {
  it("looks only at the society's pending requests raised by someone else", async () => {
    vi.mocked(prisma.upiChangeRequest.findFirst).mockResolvedValue({ id: "r1", createdAt: new Date(), newUpiId: "n@b" } as never);
    expect(await getPendingUpiRequestFor("s1", "u1")).toMatchObject({ id: "r1" });
    expect(vi.mocked(prisma.upiChangeRequest.findFirst).mock.calls[0][0]!.where).toEqual({
      societyId: "s1", status: "PENDING", requestedById: { not: "u1" },
    });
  });

  it("ignores a lapsed request", async () => {
    vi.mocked(prisma.upiChangeRequest.findFirst).mockResolvedValue({
      id: "r1", createdAt: new Date(Date.now() - UPI_REQUEST_TTL_MS - 5000), newUpiId: "n@b",
    } as never);
    expect(await getPendingUpiRequestFor("s1", "u1")).toBeNull();
  });
});

describe("isRecentUpiChange", () => {
  it("is true for two weeks after a change, false after or when never changed", async () => {
    const { isRecentUpiChange } = await import("@/lib/queries/upi");
    const now = new Date("2026-10-19T12:00:00Z");
    expect(isRecentUpiChange(null, now)).toBe(false);
    expect(isRecentUpiChange(new Date("2026-10-10T00:00:00Z"), now)).toBe(true);
    expect(isRecentUpiChange(new Date("2026-09-30T00:00:00Z"), now)).toBe(false);
  });
});
