import { describe, it, expect, vi, beforeEach } from "vitest";

const tx = {
  expense: { create: vi.fn(), findFirst: vi.fn(), deleteMany: vi.fn() },
  expenseContribution: { create: vi.fn(), findMany: vi.fn(), update: vi.fn() },
};
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: vi.fn((fn: (t: unknown) => unknown) => fn(tx)) } }));
vi.mock("@/lib/ledger", () => {
  class InsufficientCreditError extends Error {
    constructor(public readonly userId: string) { super("INSUFFICIENT_CREDIT"); }
  }
  return { depositAndApplyIn: vi.fn(), reverseExpenseCreditIn: vi.fn(), InsufficientCreditError };
});

import { createExpenseWithContributions, deleteExpenseWithContributions } from "@/lib/expense-contributions";
import { depositAndApplyIn, reverseExpenseCreditIn, InsufficientCreditError } from "@/lib/ledger";

const exp = {
  societyId: "s1", actorId: "t1", title: "Lift repair", category: "Repairs", amount: 1000,
  date: new Date("2026-10-01"), description: null, receiptUrl: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  tx.expense.create.mockResolvedValue({ id: "e1" });
  vi.mocked(depositAndApplyIn).mockResolvedValue({ applied: [], balance: 0 });
});

describe("createExpenseWithContributions", () => {
  it("creates the expense and credits other members immediately, in one transaction", async () => {
    const r = await createExpenseWithContributions(exp, [{ userId: "u2", amount: 400 }, { userId: "u1", amount: 600 }]);
    expect(tx.expense.create.mock.calls[0][0].data).toMatchObject({ societyId: "s1", title: "Lift repair", amount: 1000, addedById: "t1" });
    // members locked in a stable order
    expect(vi.mocked(depositAndApplyIn).mock.calls.map((c) => c[1].userId)).toEqual(["u1", "u2"]);
    expect(vi.mocked(depositAndApplyIn).mock.calls[0][1]).toMatchObject({
      societyId: "s1", amount: 600, type: "EXPENSE_CREDIT", expenseId: "e1", actorId: "t1", note: "Paid for: Lift repair",
    });
    expect(tx.expenseContribution.create.mock.calls[0][0].data).toMatchObject({ status: "APPROVED", userId: "u1", amount: 600, expenseTitle: "Lift repair" });
    expect(r).toMatchObject({ expenseId: "e1", pending: 0, credited: [{ userId: "u1", amount: 600 }, { userId: "u2", amount: 400 }] });
  });

  it("holds the recorder's own credit for a second person instead of crediting it", async () => {
    const r = await createExpenseWithContributions(exp, [{ userId: "t1", amount: 500 }, { userId: "u1", amount: 300 }]);
    expect(r).toMatchObject({ pending: 1, credited: [{ userId: "u1", amount: 300 }] });
    expect(depositAndApplyIn).toHaveBeenCalledTimes(1);
    const own = tx.expenseContribution.create.mock.calls.map((c) => c[0].data).find((d: { userId: string }) => d.userId === "t1");
    expect(own).toMatchObject({ status: "PENDING", requestedById: "t1" });
  });

  it("collects the dues that the new credit paid, for receipts", async () => {
    vi.mocked(depositAndApplyIn).mockResolvedValue({ applied: [{ entryId: "x1", paymentId: "p1", amount: 100, fullyPaid: true }], balance: 0 });
    const r = await createExpenseWithContributions(exp, [{ userId: "u1", amount: 100 }]);
    expect(r.applied).toHaveLength(1);
  });
});

describe("deleteExpenseWithContributions", () => {
  const found = () => tx.expense.findFirst.mockResolvedValue({ id: "e1", title: "Lift repair" });

  it("is scoped to the society and reports an unknown expense", async () => {
    tx.expense.findFirst.mockResolvedValue(null);
    expect(await deleteExpenseWithContributions("s1", "e1", "t1")).toEqual({ ok: false, reason: "NOT_FOUND" });
    expect(tx.expense.findFirst.mock.calls[0][0].where).toEqual({ id: "e1", societyId: "s1" });
    expect(tx.expense.deleteMany).not.toHaveBeenCalled();
  });

  it("takes credit back, cancels pending requests, then deletes the expense", async () => {
    found();
    tx.expenseContribution.findMany.mockResolvedValue([
      { id: "c1", userId: "u1", amount: "600", status: "APPROVED" },
      { id: "c2", userId: "u2", amount: "300", status: "PENDING" },
    ]);
    const r = await deleteExpenseWithContributions("s1", "e1", "t1");
    expect(r).toEqual({ ok: true, reversed: 1, cancelled: 1 });
    expect(reverseExpenseCreditIn).toHaveBeenCalledWith(tx, expect.objectContaining({ societyId: "s1", userId: "u1", amount: 600, expenseId: "e1" }));
    expect(tx.expenseContribution.update).toHaveBeenCalledWith({ where: { id: "c1" }, data: expect.objectContaining({ status: "REVERSED" }) });
    expect(tx.expenseContribution.update).toHaveBeenCalledWith({ where: { id: "c2" }, data: expect.objectContaining({ status: "CANCELLED" }) });
    expect(tx.expense.deleteMany).toHaveBeenCalledWith({ where: { id: "e1", societyId: "s1" } });
  });

  it("changes nothing and says why when a member has spent the credit", async () => {
    found();
    tx.expenseContribution.findMany.mockResolvedValue([{ id: "c1", userId: "u1", amount: "600", status: "APPROVED" }]);
    vi.mocked(reverseExpenseCreditIn).mockRejectedValue(new InsufficientCreditError("u1"));
    expect(await deleteExpenseWithContributions("s1", "e1", "t1")).toEqual({ ok: false, reason: "CREDIT_USED", userId: "u1" });
  });

  it("lets other errors through", async () => {
    found();
    tx.expenseContribution.findMany.mockRejectedValue(new Error("db"));
    await expect(deleteExpenseWithContributions("s1", "e1", "t1")).rejects.toThrow("db");
  });
});
