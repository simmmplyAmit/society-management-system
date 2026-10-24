import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { expenseContribution: { findFirst: vi.fn(), updateMany: vi.fn() } },
}));
vi.mock("@/lib/session", () => ({ requireRole: vi.fn() }));
vi.mock("@/lib/ledger", () => ({ depositAndApply: vi.fn() }));
vi.mock("@/lib/credit-service", () => ({ notifyApplied: vi.fn() }));
vi.mock("@/lib/notify/expense-credit", () => ({ notifyExpenseCredit: vi.fn() }));

import { approveContribution, rejectContribution, cancelContribution } from "@/actions/expense-contributions";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { depositAndApply } from "@/lib/ledger";
import { notifyApplied } from "@/lib/credit-service";
import { notifyExpenseCredit } from "@/lib/notify/expense-credit";

const c = vi.mocked(prisma.expenseContribution);
const fd = (f: Record<string, string>) => {
  const d = new FormData();
  Object.entries(f).forEach(([k, v]) => d.set(k, v));
  return d;
};
const me = (id: string, role = "TREASURER") => ({ user: { id, role, societyId: "s1" } });
const pending = (over: Record<string, unknown> = {}) => ({
  id: "k1", userId: "t1", amount: "500", expenseId: "e1", expenseTitle: "Lift repair", requestedById: "t1", ...over,
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireRole).mockResolvedValue(me("a1", "ADMIN") as never);
  c.findFirst.mockResolvedValue(pending() as never);
  c.updateMany.mockResolvedValue({ count: 1 } as never);
  vi.mocked(depositAndApply).mockResolvedValue({ applied: [{ entryId: "x", paymentId: "p", amount: 1, fullyPaid: true }], balance: 0 });
});

describe("approveContribution", () => {
  it("is ADMIN/TREASURER only and looks the request up inside the society", async () => {
    await approveContribution("k1");
    expect(requireRole).toHaveBeenCalledWith(["ADMIN", "TREASURER"]);
    expect(c.findFirst.mock.calls[0][0]!.where).toEqual({ id: "k1", societyId: "s1", status: "PENDING" });
  });

  it("credits the member for a different approver, then sends receipts and the credit email", async () => {
    expect(await approveContribution("k1")).toEqual({ success: true });
    expect(depositAndApply).toHaveBeenCalledWith(expect.objectContaining({
      societyId: "s1", userId: "t1", actorId: "a1", amount: 500, type: "EXPENSE_CREDIT", expenseId: "e1",
    }));
    expect(c.updateMany.mock.calls[0][0]).toEqual({
      where: { id: "k1", societyId: "s1", status: "PENDING" },
      data: { status: "APPROVED", reviewedById: "a1", reviewedAt: expect.any(Date) },
    });
    expect(notifyApplied).toHaveBeenCalled();
    expect(notifyExpenseCredit).toHaveBeenCalledWith("s1", [{ userId: "t1", amount: 500, expenseTitle: "Lift repair" }]);
  });

  it("never lets the recorder approve credit for their own expense", async () => {
    vi.mocked(requireRole).mockResolvedValue(me("t1") as never);
    expect(await approveContribution("k1")).toMatchObject({ error: expect.stringMatching(/your own/) });
    expect(depositAndApply).not.toHaveBeenCalled();
    expect(c.updateMany).not.toHaveBeenCalled();
  });

  it("refuses handled requests, deleted expenses and lost races", async () => {
    c.findFirst.mockResolvedValue(null);
    expect(await approveContribution("k1")).toMatchObject({ error: expect.any(String) });
    c.findFirst.mockResolvedValue(pending({ expenseId: null }) as never);
    expect(await approveContribution("k1")).toMatchObject({ error: expect.stringMatching(/deleted/) });
    c.findFirst.mockResolvedValue(pending() as never);
    c.updateMany.mockResolvedValue({ count: 0 } as never);
    expect(await approveContribution("k1")).toMatchObject({ error: expect.any(String) });
    expect(depositAndApply).not.toHaveBeenCalled();
  });

  it("puts the request back when the credit could not be recorded", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(depositAndApply).mockRejectedValue(new Error("db"));
    expect(await approveContribution("k1")).toMatchObject({ error: expect.any(String) });
    expect(c.updateMany).toHaveBeenLastCalledWith({
      where: { id: "k1", societyId: "s1", status: "APPROVED" },
      data: { status: "PENDING", reviewedById: null, reviewedAt: null },
    });
  });
});

describe("rejectContribution / cancelContribution", () => {
  it("rejects with a reason for a different person, scoped to the society", async () => {
    expect(await rejectContribution(fd({ contributionId: "k1", reason: "No bill" }))).toEqual({ success: true });
    expect(c.updateMany.mock.calls[0][0]).toEqual({
      where: { id: "k1", societyId: "s1", status: "PENDING" },
      data: expect.objectContaining({ status: "REJECTED", note: "No bill", reviewedById: "a1" }),
    });
    expect(depositAndApply).not.toHaveBeenCalled();
  });

  it("tells the recorder to withdraw instead of rejecting their own request", async () => {
    vi.mocked(requireRole).mockResolvedValue(me("t1") as never);
    expect(await rejectContribution(fd({ contributionId: "k1" }))).toMatchObject({ error: expect.stringMatching(/Withdraw/) });
  });

  it("lets only the recorder withdraw their own pending request", async () => {
    vi.mocked(requireRole).mockResolvedValue(me("t1") as never);
    expect(await cancelContribution("k1")).toEqual({ success: true });
    expect(c.updateMany.mock.calls[0][0]!.where).toEqual({ id: "k1", societyId: "s1", requestedById: "t1", status: "PENDING" });
    c.updateMany.mockResolvedValue({ count: 0 } as never);
    expect(await cancelContribution("someone-elses")).toMatchObject({ error: expect.any(String) });
  });
});
