import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: { maintenancePayment: { findMany: vi.fn() } } }));
vi.mock("@/lib/session", () => ({
  requireRole: vi.fn().mockResolvedValue({ user: { id: "t1", role: "TREASURER", societyId: "s1" } }),
}));
vi.mock("@/lib/notify/dispatch", () => ({ notifyPayments: vi.fn().mockResolvedValue({ sent: 2, failed: 0, skipped: 1 }) }));

import { sendDueReminders } from "@/actions/notifications";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { notifyPayments } from "@/lib/notify/dispatch";

const fd = (ids: string[]) => {
  const d = new FormData();
  ids.forEach((id) => d.append("paymentId", id));
  return d;
};

beforeEach(() => vi.clearAllMocks());

describe("sendDueReminders", () => {
  it("is limited to ADMIN and TREASURER", async () => {
    vi.mocked(prisma.maintenancePayment.findMany).mockResolvedValue([{ id: "p1" }] as never);
    await sendDueReminders(fd(["p1"]));
    expect(requireRole).toHaveBeenCalledWith(["ADMIN", "TREASURER"]);
  });

  it("only reminds unpaid dues of the session's society", async () => {
    vi.mocked(prisma.maintenancePayment.findMany).mockResolvedValue([{ id: "p1" }] as never);
    const r = await sendDueReminders(fd(["p1", "foreign"]));
    expect(vi.mocked(prisma.maintenancePayment.findMany).mock.calls[0][0]!.where).toEqual({
      id: { in: ["p1", "foreign"] }, societyId: "s1", status: { in: ["PENDING", "OVERDUE"] },
    });
    expect(notifyPayments).toHaveBeenCalledWith(
      "MANUAL_REMINDER",
      [{ paymentId: "p1", keySuffix: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) }],
      "s1"
    );
    expect(r).toMatchObject({ success: true, sent: 2, skipped: 1 });
  });

  it("does nothing for an empty or oversized selection", async () => {
    expect(await sendDueReminders(fd([]))).toMatchObject({ error: expect.any(String) });
    expect(await sendDueReminders(fd(Array.from({ length: 201 }, (_, i) => `p${i}`)))).toMatchObject({ error: expect.any(String) });
    expect(notifyPayments).not.toHaveBeenCalled();
  });

  it("reports when none of the dues are unpaid in this society", async () => {
    vi.mocked(prisma.maintenancePayment.findMany).mockResolvedValue([]);
    expect(await sendDueReminders(fd(["x"]))).toMatchObject({ error: expect.any(String) });
    expect(notifyPayments).not.toHaveBeenCalled();
  });
});
