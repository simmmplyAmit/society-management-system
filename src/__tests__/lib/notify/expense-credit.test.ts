import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: { society: { findUnique: vi.fn() }, user: { findMany: vi.fn() } } }));
vi.mock("@/lib/notify/email", () => ({ sendEmail: vi.fn().mockResolvedValue({ ok: true }) }));
vi.mock("@/lib/notify/sender", () => ({
  societySender: vi.fn().mockResolvedValue({ fromName: "Sunrise", replyTo: ["treasurer@x.com"] }),
  senderCache: vi.fn(() => vi.fn().mockResolvedValue({ fromName: "Sunrise", replyTo: ["treasurer@x.com"] })),
}));

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/notify/email";
import { notifyExpenseCredit } from "@/lib/notify/expense-credit";
import { societySender } from "@/lib/notify/sender";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.society.findUnique).mockResolvedValue({ name: "Sunrise" } as never);
  vi.mocked(prisma.user.findMany).mockResolvedValue([{ id: "u1", name: "Asha", email: "a@x.com" }] as never);
});

describe("notifyExpenseCredit", () => {
  it("emails only active, verified members of the society", async () => {
    await notifyExpenseCredit("s1", [{ userId: "u1", amount: 600, expenseTitle: "Lift" }, { userId: "gone", amount: 5, expenseTitle: "X" }]);
    expect(vi.mocked(prisma.user.findMany).mock.calls[0][0]!.where).toEqual({
      id: { in: ["u1", "gone"] }, societyId: "s1", isActive: true, emailVerifiedAt: { not: null },
    });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendEmail).mock.calls[0][0]).toMatchObject({
      to: "a@x.com", subject: expect.stringContaining("₹600"), fromName: "Sunrise", replyTo: ["treasurer@x.com"],
    });
    expect(societySender).toHaveBeenCalledWith("s1", "dues");
  });

  it("does nothing for an empty list and never throws", async () => {
    await notifyExpenseCredit("s1", []);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(prisma.user.findMany).mockRejectedValue(new Error("db"));
    await expect(notifyExpenseCredit("s1", [{ userId: "u1", amount: 1, expenseTitle: "x" }])).resolves.toBeUndefined();
  });
});
