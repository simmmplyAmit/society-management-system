import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    expense: { create: vi.fn().mockResolvedValue({ id: "e1" }), deleteMany: vi.fn() },
    expenseContribution: { count: vi.fn().mockResolvedValue(0) },
    user: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/expense-contributions", () => ({
  createExpenseWithContributions: vi.fn(),
  deleteExpenseWithContributions: vi.fn(),
}));
vi.mock("@/lib/credit-service", () => ({ notifyApplied: vi.fn() }));
vi.mock("@/lib/notify/expense-credit", () => ({ notifyExpenseCredit: vi.fn() }));
vi.mock("@/lib/session", () => ({
  requireRole: vi.fn().mockResolvedValue({ user: { id: "t1", role: "TREASURER", societyId: "s1" } }),
}));

import { addExpense, deleteExpense } from "@/actions/expenses";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { createExpenseWithContributions, deleteExpenseWithContributions } from "@/lib/expense-contributions";
import { notifyApplied } from "@/lib/credit-service";
import { notifyExpenseCredit } from "@/lib/notify/expense-credit";

const fd = (f: Record<string, string>) => {
  const d = new FormData();
  Object.entries(f).forEach(([k, v]) => d.set(k, v));
  return d;
};
const valid = { title: "Lift repair", category: "Repairs", amount: "2500.50", date: "2026-10-01" };

describe("addExpense", () => {
  beforeEach(() => vi.clearAllMocks());

  it("is limited to TREASURER and ADMIN", async () => {
    await addExpense(fd(valid));
    expect(requireRole).toHaveBeenCalledWith(["TREASURER", "ADMIN"]);
  });

  it("stores the expense against the session's society and user", async () => {
    const r = await addExpense(fd(valid));
    expect(r.success).toBe(true);
    expect(prisma.expense.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ societyId: "s1", addedById: "t1", amount: 2500.5, title: "Lift repair" }),
      select: { id: true },
    });
  });

  it("rejects non-positive amounts", async () => {
    const r = await addExpense(fd({ ...valid, amount: "0" }));
    expect(r.error).toMatch(/positive/);
    expect(prisma.expense.create).not.toHaveBeenCalled();
  });

  it("rejects a missing title", async () => {
    const r = await addExpense(fd({ ...valid, title: "" }));
    expect(r.error).toBeDefined();
    expect(prisma.expense.create).not.toHaveBeenCalled();
  });
});

describe("addExpense with members who paid", () => {
  const withRows = (rows: unknown, extra: Record<string, string> = {}) =>
    fd({ ...valid, amount: "1000", contributions: JSON.stringify(rows), ...extra });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireRole).mockResolvedValue({ user: { id: "t1", role: "TREASURER", societyId: "s1" } } as never);
    vi.mocked(prisma.user.findMany).mockResolvedValue([{ id: "u1" }, { id: "u2" }] as never);
    vi.mocked(createExpenseWithContributions).mockResolvedValue({
      expenseId: "e1", credited: [{ userId: "u1", amount: 600 }], pending: 1, applied: [{ entryId: "x", paymentId: "p", amount: 1, fullyPaid: true }],
    });
  });

  it("only validates members of the caller's society who are linked to a flat", async () => {
    await addExpense(withRows([{ userId: "u1", amount: 600 }, { userId: "u2", amount: 400 }]));
    expect(vi.mocked(prisma.user.findMany).mock.calls[0][0]!.where).toEqual({
      id: { in: ["u1", "u2"] }, societyId: "s1", isActive: true, flatResidents: { some: {} },
    });
  });

  it("records the expense and credits members in one go, then sends receipts and emails", async () => {
    const r = await addExpense(withRows([{ userId: "u1", amount: 600 }, { userId: "u2", amount: 400 }], { receiptUrl: "https://x.test/bill.pdf" }));
    expect(r).toEqual({ success: true, expenseId: "e1", credited: 1, pendingApproval: 1 });
    expect(createExpenseWithContributions).toHaveBeenCalledWith(
      expect.objectContaining({ societyId: "s1", actorId: "t1", amount: 1000, receiptUrl: "https://x.test/bill.pdf", title: "Lift repair" }),
      [{ userId: "u1", amount: 600 }, { userId: "u2", amount: 400 }]
    );
    expect(prisma.expense.create).not.toHaveBeenCalled();
    expect(notifyApplied).toHaveBeenCalledWith("s1", expect.any(Array));
    expect(notifyExpenseCredit).toHaveBeenCalledWith("s1", [{ userId: "u1", amount: 600, expenseTitle: "Lift repair" }]);
  });

  it("keeps the simple path when no members are tagged", async () => {
    const r = await addExpense(fd({ ...valid, contributions: "[]" }));
    expect(r.success).toBe(true);
    expect(prisma.expense.create).toHaveBeenCalled();
    expect(createExpenseWithContributions).not.toHaveBeenCalled();
  });

  it("refuses amounts above the expense, duplicate members and non-members", async () => {
    expect(await addExpense(withRows([{ userId: "u1", amount: 700 }, { userId: "u2", amount: 400 }]))).toMatchObject({ error: expect.stringMatching(/more than the expense/) });
    expect(await addExpense(withRows([{ userId: "u1", amount: 100 }, { userId: "u1", amount: 100 }]))).toMatchObject({ error: expect.stringMatching(/only be listed once/) });
    vi.mocked(prisma.user.findMany).mockResolvedValue([{ id: "u1" }] as never);
    expect(await addExpense(withRows([{ userId: "u1", amount: 100 }, { userId: "outsider", amount: 100 }]))).toMatchObject({ error: expect.stringMatching(/live in this society/) });
    expect(createExpenseWithContributions).not.toHaveBeenCalled();
  });

  it("validates the member rows, receipt link and JSON", async () => {
    expect(await addExpense(withRows([{ userId: "u1", amount: 0 }]))).toMatchObject({ error: expect.any(String) });
    expect(await addExpense(withRows([{ userId: "", amount: 5 }]))).toMatchObject({ error: expect.any(String) });
    expect(await addExpense(fd({ ...valid, contributions: "not json" }))).toMatchObject({ error: expect.any(String) });
    expect(await addExpense(fd({ ...valid, receiptUrl: "javascript:alert(1)" }))).toMatchObject({ error: expect.stringMatching(/https/) });
    expect(await addExpense(withRows(Array.from({ length: 21 }, (_, i) => ({ userId: `u${i}`, amount: 1 }))))).toMatchObject({ error: expect.any(String) });
    expect(createExpenseWithContributions).not.toHaveBeenCalled();
  });

  it("reports a failure without crashing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(createExpenseWithContributions).mockRejectedValue(new Error("db"));
    expect(await addExpense(withRows([{ userId: "u1", amount: 100 }]))).toMatchObject({ error: expect.any(String) });
  });
});

describe("deleteExpense", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireRole).mockResolvedValue({ user: { id: "t1", role: "TREASURER", societyId: "s1" } } as never);
    vi.mocked(prisma.expenseContribution.count).mockResolvedValue(0);
  });

  it("only deletes within the caller's society", async () => {
    await deleteExpense("e1");
    expect(prisma.expense.deleteMany).toHaveBeenCalledWith({ where: { id: "e1", societyId: "s1" } });
  });

  it("takes back member credit with the expense, when it is still unspent", async () => {
    vi.mocked(prisma.expenseContribution.count).mockResolvedValue(2);
    vi.mocked(deleteExpenseWithContributions).mockResolvedValue({ ok: true, reversed: 2, cancelled: 0 });
    expect((await deleteExpense("e1")).error).toBeUndefined();
    expect(vi.mocked(prisma.expenseContribution.count).mock.calls[0][0]!.where).toEqual({
      expenseId: "e1", societyId: "s1", status: { in: ["APPROVED", "PENDING"] },
    });
    expect(deleteExpenseWithContributions).toHaveBeenCalledWith("s1", "e1", "t1");
    expect(prisma.expense.deleteMany).not.toHaveBeenCalled();
  });

  it("refuses when a member already spent the credit", async () => {
    vi.mocked(prisma.expenseContribution.count).mockResolvedValue(1);
    vi.mocked(deleteExpenseWithContributions).mockResolvedValue({ ok: false, reason: "CREDIT_USED", userId: "u1" });
    expect(await deleteExpense("e1")).toMatchObject({ error: expect.stringMatching(/already used the credit/) });
  });
});
