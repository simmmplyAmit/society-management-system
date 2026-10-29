import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: { maintenancePayment: { findMany: vi.fn() } } }));
vi.mock("@/lib/notify/dispatch", () => ({ notifyPayments: vi.fn().mockResolvedValue({ sent: 0, failed: 0, skipped: 0 }) }));

import { prisma } from "@/lib/prisma";
import { notifyPayments } from "@/lib/notify/dispatch";
import { reminderSlot, dayKey, sendNewDueNotices, sendScheduledReminders } from "@/lib/notify/schedule";

const find = vi.mocked(prisma.maintenancePayment.findMany);
beforeEach(() => vi.clearAllMocks());

describe("reminderSlot", () => {
  const at = (day: number) => new Date(2026, 9, day, 12); // October 2026
  it("starts 5 days into the billing month, then weekly, max 3", () => {
    expect(reminderSlot(10, 2026, at(1))).toBeNull(); // day 0
    expect(reminderSlot(10, 2026, at(5))).toBeNull(); // day 4
    expect(reminderSlot(10, 2026, at(6))).toBe(1); // day 5
    expect(reminderSlot(10, 2026, at(12))).toBe(1); // day 11
    expect(reminderSlot(10, 2026, at(13))).toBe(2); // day 12
    expect(reminderSlot(10, 2026, at(20))).toBe(3); // day 19
    expect(reminderSlot(10, 2026, at(27))).toBeNull(); // day 26: no more
  });
  it("never reminds for a future period", () => {
    expect(reminderSlot(11, 2026, at(18))).toBeNull();
  });
});

describe("dayKey", () => {
  it("formats the Indian calendar date", () => {
    expect(dayKey(new Date("2026-10-18T20:00:00Z"))).toBe("2026-10-19"); // already the 19th in IST
  });
});

describe("sendNewDueNotices", () => {
  const now = new Date(2026, 9, 18);
  it("targets only recent, pending, non-imported dues of the current or previous month", async () => {
    find.mockResolvedValue([{ id: "p1" }] as never);
    await sendNewDueNotices({ societyId: "s1", now });
    const where = find.mock.calls[0][0]!.where as Record<string, unknown>;
    expect(where).toMatchObject({
      status: "PENDING",
      importBatchId: null,
      societyId: "s1",
      createdAt: { gte: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000) },
      OR: [{ month: 10, year: 2026 }, { month: 9, year: 2026 }],
    });
    expect(notifyPayments).toHaveBeenCalledWith("DUE_CREATED", [{ paymentId: "p1", keySuffix: "" }], "s1");
  });

  it("covers active societies when no society is given", async () => {
    find.mockResolvedValue([]);
    await sendNewDueNotices({ now });
    expect(find.mock.calls[0][0]!.where).toMatchObject({ society: { isActive: true } });
  });
});

describe("sendScheduledReminders", () => {
  it("sends a reminder only for payments whose slot is due, tagged with the slot", async () => {
    find.mockResolvedValue([
      { id: "old", month: 10, year: 2026 }, // day 17 -> slot 2
      { id: "fresh", month: 10, year: 2026 },
    ] as never);
    // Both rows share a period, so just check slot tagging and that a not-yet-due period is skipped
    await sendScheduledReminders(new Date(2026, 9, 18, 12));
    const call = vi.mocked(notifyPayments).mock.calls[0];
    expect(call[0]).toBe("DUE_REMINDER");
    expect(call[1]).toEqual([
      { paymentId: "old", keySuffix: "2" },
      { paymentId: "fresh", keySuffix: "2" },
    ]);

    vi.clearAllMocks();
    find.mockResolvedValue([{ id: "p", month: 10, year: 2026 }] as never);
    await sendScheduledReminders(new Date(2026, 9, 2));
    expect(vi.mocked(notifyPayments).mock.calls[0][1]).toEqual([]);
  });
});
